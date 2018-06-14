"use strict";

/**
 * This is the base class for block scanners
 *
 * @module executables/block_scanner/for_tx_status_and_balance_sync
 */
const fs = require('fs')
  , Web3 = require('web3')
  , abiDecoder = require('abi-decoder')
  , openStPlatform = require('@openstfoundation/openst-platform')
  , openStPayments = require('@openstfoundation/openst-payments')
  , openStorage = require('@openstfoundation/openst-storage')
  , openSTNotification = require('@openstfoundation/openst-notification')
  , BigNumber = require('bignumber.js')
  , uuid = require('uuid')
;

const rootPrefix = '../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , TransactionMeta = require(rootPrefix + '/app/models/transaction_meta')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , autoscalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
  , Erc20ContractAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/erc20_contract_address')
  , Erc20ContractUuidCacheKlass = require(rootPrefix + '/lib/cache_multi_management/erc20_contract_uuid')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , PostAirdropPayKlass = openStPayments.services.airdropManager.postAirdropPay
  , ManagedAddressesModel = require(rootPrefix + '/app/models/managed_address')
  , notificationTopics = require(rootPrefix + '/lib/global_constant/notification_topics')
;

const transactionLogModelDdb = openStorage.TransactionLogModel
  , tokenBalanceModelDdb = openStorage.TokenBalanceModel
  , coreAbis = openStPlatform.abis
;

abiDecoder.addABI(coreAbis.airdrop);
abiDecoder.addABI(coreAbis.brandedToken);
// abiDecoder.addABI(coreAbis.openSTUtility);

const BlockScannerForTxStatusAndBalanceSync = function (params) {
  const oThis = this
  ;

  oThis.filePath = params.file_path;
  oThis.currentBlock = 0;
  oThis.scannerData = {};
  oThis.interruptSignalObtained = false;
  oThis.highestBlock = null;

  oThis.TransferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  oThis.ProcessedMintEventSignature = '0x96989a6b1d8c3bb8d6cc22e14b188b5c14b1f33f34ff07ea2e4fd6d880dac2c7';
  oThis.RevertedMintEventSignature = '0x86e6b95641fbf0f8939eb3da2e7e26aee0188048353d08a45c78218e84cf1d4f';

  oThis.OpenSTUtilityContractAddr = chainInteractionConstants.OPENSTUTILITY_CONTRACT_ADDR.toLowerCase();
  oThis.StPrimeContractUuid = chainInteractionConstants.ST_PRIME_UUID.toLowerCase();
  oThis.ZeroXAddress = '0x0000000000000000000000000000000000000000';

  oThis.tokenTransferKind = new TransactionMeta().invertedKinds[transactionLogConst.tokenTransferTransactionType];
  oThis.stpTransferKind = new TransactionMeta().invertedKinds[transactionLogConst.stpTransferTransactionType];

  oThis.failedTxStatus = new TransactionLogModel().invertedStatuses[transactionLogConst.failedStatus];
  oThis.completeTxStatus = new TransactionLogModel().invertedStatuses[transactionLogConst.completeStatus];

};

BlockScannerForTxStatusAndBalanceSync.prototype = {

  /**
   * Intentional block delay
   */
  INTENTIONAL_BLOCK_DELAY: 0,

  /**
   * Starts the process of the script with initializing processor
   */
  init: function () {
    const oThis = this
    ;

    oThis.web3Provider = new Web3(chainInteractionConstants.UTILITY_GETH_WS_PROVIDER);

    // Read this from a file
    oThis.scannerData = JSON.parse(fs.readFileSync(oThis.filePath).toString());

    oThis.checkForNewBlocks();
  },

  /**
   * Check for new blocks
   */
  checkForNewBlocks: async function () {
    const oThis = this
    ;

    if (oThis.interruptSignalObtained) {
      logger.win('* Exiting Process after interrupt signal obtained.');
      process.exit(0);
    }

    const processNewBlocksAsync = async function () {
      try {

        oThis.initParams();

        await oThis.refreshHighestBlock();

        // return if nothing more to do, as of now.
        if (oThis.highestBlock - oThis.INTENTIONAL_BLOCK_DELAY <= oThis.scannerData.lastProcessedBlock) return oThis.schedule();

        oThis.currentBlock = oThis.scannerData.lastProcessedBlock + 1;

        logger.log('Current Block =', oThis.currentBlock);

        oThis.currentBlockInfo = await oThis.web3Provider.eth.getBlock(oThis.currentBlock);

        if (!oThis.currentBlockInfo) return oThis.schedule();

        await oThis.categorizeTransactions();

        await oThis.getTransactionReceipts();

        await oThis.generateToUpdateDataForKnownTx();

        await oThis.generateToUpdateDataForUnKnownTx();

        await oThis.updateTransactionLogs();

        if (oThis.recognizedTxHashes.length === 0) {
          oThis.updateScannerDataFile();
          return oThis.schedule();
        }

        oThis.updateScannerDataFile();

        oThis.schedule();
      } catch (err) {
        logger.error('Exception got:', err);

        if (oThis.interruptSignalObtained) {
          logger.win('* Exiting Process after interrupt signal obtained.');
          process.exit(0);
        } else {
          oThis.reInit();
        }
      }
    };

    await processNewBlocksAsync()
      .catch(function (error) {
        logger.error('executables/block_scanner/base.js::processNewBlocksAsync::catch');
        logger.error(error);

        oThis.schedule();
      });
  },

  /**
   * Init params
   */
  initParams: function () {
    const oThis = this
    ;

    oThis.tokenTransferTxHashesMap = {};
    oThis.recognizedTxUuidsGroupedByClientId = {};
    oThis.recognizedTxHashes = [];
    oThis.knownTxUuidToTxHashMap = {};
    oThis.txHashToTxReceiptMap = {};
    oThis.clientIdWiseDataToUpdate = {};
    oThis.unRecognizedTxHashes = []
  },

  /**
   * Categorize Transactions using transaction_meta table
   */
  categorizeTransactions: async function (allTxHashes) {
    const oThis = this
      , batchSize = 100
    ;

    var batchNo = 1
      , totalBtTransfers = 0
      , totalSTPTransfers = 0
    ;

    // batch-wise fetch data from transaction_meta table.
    while (true) {
      const offset = (batchNo - 1) * batchSize
        , batchedTxHashes = oThis.currentBlockInfo.transactions.slice(offset, batchSize + offset)
        , recognizedTxHashesMap = {}
      ;

      batchNo = batchNo + 1;

      if (batchedTxHashes.length === 0) break;

      const batchedTxLogRecords = await new TransactionMeta().getByTransactionHash(batchedTxHashes);

      for (var i = 0; i < batchedTxLogRecords.length; i++) {

        const currRecord = batchedTxLogRecords[i];

        recognizedTxHashesMap[currRecord.transaction_hash] = 1;

        if (currRecord.kind == oThis.tokenTransferKind) {
          totalBtTransfers = totalBtTransfers + 1;
          oThis.tokenTransferTxHashesMap[currRecord.transaction_hash] = 1;
        } else if (currRecord.kind == oThis.stpTransferKind) {
          totalSTPTransfers = totalSTPTransfers + 1;
        } else {
          continue;
        }

        oThis.recognizedTxUuidsGroupedByClientId[currRecord.client_id] = oThis.recognizedTxUuidsGroupedByClientId[currRecord.client_id] || [];
        oThis.recognizedTxUuidsGroupedByClientId[currRecord.client_id].push(currRecord.transaction_uuid);

        oThis.recognizedTxHashes.push(currRecord.transaction_hash);
        oThis.knownTxUuidToTxHashMap[currRecord.transaction_uuid] = currRecord.transaction_hash;
      }

      for(var i=0; i<batchedTxHashes.length; i++){
        //if already known transaction skip here.
        if(recognizedTxHashesMap[batchedTxHashes[i]]) continue;
        oThis.unRecognizedTxHashes.push(batchedTxHashes[i]);
      }

    }

    logger.log('Total BT Transfers:', totalBtTransfers);
    logger.log('Total STP Transfers:', totalSTPTransfers);

    return Promise.resolve();
  },

  /**
   * Get transaction receipt
   */
  getTransactionReceipts: async function () {
    const oThis = this
      , batchSize = 100
    ;

    let batchNo = 1;

    while (true) {
      const offset = (batchNo - 1) * batchSize
        , batchedTxHashes = oThis.currentBlockInfo.transactions.slice(offset, batchSize + offset)
        , promiseArray = []
      ;

      batchNo = batchNo + 1;

      if (batchedTxHashes.length === 0) break;

      for (var i = 0; i < batchedTxHashes.length; i++) {
        promiseArray.push(oThis.web3Provider.eth.getTransactionReceipt(batchedTxHashes[i]))
      }

      const txReceiptResults = await Promise.all(promiseArray);

      console.log("-----------------999--------------txReceiptResults-", JSON.stringify(txReceiptResults));

      for (var i = 0; i < batchedTxHashes.length; i++) {
        oThis.txHashToTxReceiptMap[batchedTxHashes[i]] = txReceiptResults[i];
      }
    }

    logger.win('* Fetching Tx Receipts DONE');

    return Promise.resolve();
  },

  /**
   * Generate to update data
   */
  generateToUpdateDataForKnownTx: async function () {
    const oThis = this
      , batchSize = 50
    ;
    console.log("----------------oThis.recognizedTxUuidsGroupedByClientId---", JSON.stringify(oThis.recognizedTxUuidsGroupedByClientId));
    for (var clientId in oThis.recognizedTxUuidsGroupedByClientId) {
      let txUuids = oThis.recognizedTxUuidsGroupedByClientId[clientId];

      console.log("----------------txUuids---", JSON.stringify(txUuids));
      let batchNo = 1
      ;

      oThis.clientIdWiseDataToUpdate[clientId] = [];

      while (true) {
        const offset = (batchNo - 1) * batchSize
          , batchedTxUuids = txUuids.slice(offset, batchSize + offset)
        ;

        batchNo = batchNo + 1;

        if (batchedTxUuids.length === 0) break;

        console.log("------1----batchedTxUuids---", JSON.stringify(batchedTxUuids));
        let batchGetItemResponse = await new transactionLogModelDdb({
          client_id: clientId,
          ddb_service: ddbServiceObj,
          auto_scaling: autoscalingServiceObj
        }).batchGetItem(batchedTxUuids);

        console.log("------2----batchGetItemResponse---", JSON.stringify(batchGetItemResponse));
        if (batchGetItemResponse.isFailure()) return Promise.reject(batchGetItemResponse);

        let batchGetItemData = batchGetItemResponse.data;

        console.log("------3----oThis.knownTxUuidToTxHashMap---", JSON.stringify(oThis.knownTxUuidToTxHashMap));
        console.log("------4----oThis.txHashToTxReceiptMap---", JSON.stringify(oThis.txHashToTxReceiptMap));
        console.log("------4----oThis.tokenTransferTxHashesMap---", JSON.stringify(oThis.tokenTransferTxHashesMap));
        for (var txUuid in batchGetItemData) {

          let txHash = oThis.knownTxUuidToTxHashMap[txUuid];
          let txReceipt = oThis.txHashToTxReceiptMap[txHash];

          let toUpdateFields = {}
            , eventData= {};
          console.log("------5----txHash---", txHash, '--', JSON.stringify(oThis.tokenTransferTxHashesMap[txHash]));

          if (oThis.tokenTransferTxHashesMap[txHash]) {
            const decodedEvents = abiDecoder.decodeLogs(txReceipt.logs);

            if (batchGetItemData[txUuid].post_receipt_process_params) {
              const postAirdropParams = batchGetItemData[txUuid].post_receipt_process_params;
              console.log("postAirdropParams--", JSON.stringify(postAirdropParams));
              const postAirdropPay = new PostAirdropPayKlass(postAirdropParams, decodedEvents, txReceipt.status);
              const payResp = await postAirdropPay.perform();
              console.log("---payResp--", JSON.stringify(payResp));
            }

            eventData = await oThis._getEventData(decodedEvents);

            console.log('----------------------eventData-', txHash, JSON.stringify(eventData));
            toUpdateFields = {
              commission_amount_in_wei: eventData._commissionTokenAmount,
              amount_in_wei: eventData._tokenAmount
            };
          }

          toUpdateFields.transaction_uuid = txUuid;
          toUpdateFields.transfer_events = eventData.transfer_events;
          toUpdateFields.post_receipt_process_params = null;
          toUpdateFields.gas_used = txReceipt.gasUsed;
          toUpdateFields.block_number = txReceipt.blockNumber;
          toUpdateFields.status = parseInt(txReceipt.status, 16) == 1 ? oThis.completeTxStatus : oThis.failedTxStatus;

          oThis.clientIdWiseDataToUpdate[clientId].push(Object.assign(batchGetItemData[txUuid], toUpdateFields));

        }

      }
      console.log('----------------------oThis.clientIdWiseDataToUpdate-', clientId, JSON.stringify(oThis.clientIdWiseDataToUpdate));
    }
  },

  /**
   * Generate to update data for unrecognized transaction if it belongs to us.
   */
  generateToUpdateDataForUnKnownTx: async function () {
    const oThis = this
      , erc20Addresses = []
      , txHashToShortListedEventsMap = {}
    ;
    let erc20ContractAddressesData = {};

    console.log("c----------------------oThis.unRecognizedTxHashes----", JSON.stringify(oThis.unRecognizedTxHashes));

    for(var i=0; i<oThis.unRecognizedTxHashes.length; i++){
      let txHash = oThis.unRecognizedTxHashes[i];
      let txReceipt = oThis.txHashToTxReceiptMap[txHash];

      console.log("c----------------------txReceipt----", txHash, '--', JSON.stringify(txReceipt));
      for(var j=0; j<txReceipt.logs.length; j++){
        erc20Addresses.push(txReceipt.logs[j].address);
      }

    }

    console.log("c----------------------erc20Addresses----", JSON.stringify(erc20Addresses));

    if (erc20Addresses.length > 0) {
      // from these addresses create a map of addresses of which are ERC20 address
      let cacheObj = new Erc20ContractAddressCacheKlass({addresses: erc20Addresses})
        , cacheFetchRsp = await cacheObj.fetch()
      ;
      if (cacheFetchRsp.isFailure()) {
        return Promise.reject(cacheFetchRsp)
      }
      erc20ContractAddressesData = cacheFetchRsp.data;
    }

    for(var i=0; i<oThis.unRecognizedTxHashes.length; i++){
      let txHash = oThis.unRecognizedTxHashes[i];
      let txReceipt = oThis.txHashToTxReceiptMap[txHash];

      for(var j=0; j<txReceipt.logs.length; j++){
        let txReceiptLogElement = txReceipt.logs[j]
          , contractAddress = txReceiptLogElement.address.toLowerCase()
          , eventSignature = txReceiptLogElement.topics[0]
          , isKnownBTContract = erc20ContractAddressesData[contractAddress]
          , isTransferEvent = (eventSignature === oThis.TransferEventSignature)
          // , isUtilityContract = (oThis.OpenSTUtilityContractAddr === contractAddress)
          // , isProcessedMintEvent = (eventSignature === oThis.ProcessedMintEventSignature)
          // , isRevertedMintEvent = (eventSignature === oThis.RevertedMintEventSignature)
        ;

        if((isKnownBTContract && isTransferEvent)) { //|| (isUtilityContract && (isProcessedMintEvent || isRevertedMintEvent))){
          txHashToShortListedEventsMap[txHash] = txHashToShortListedEventsMap[txHash] || [];
          txHashToShortListedEventsMap[txHash].push(txReceiptLogElement);
        }
      }
    }

    console.log("----------------------txHashToShortListedEventsMap----", JSON.stringify(txHashToShortListedEventsMap));
    let txHashDecodedEventsMap = await oThis._decodeTransactionEvents(txHashToShortListedEventsMap);

    let balanceAdjustmentRsp = await oThis._computeBalanceAdjustments(txHashDecodedEventsMap, erc20ContractAddressesData);
    let balanceAdjustmentMap = balanceAdjustmentRsp['balanceAdjustmentMap']
      , txHashTransferEventsMap = balanceAdjustmentRsp['txHashTransferEventsMap']
      , affectedAddresses = balanceAdjustmentRsp['affectedAddresses']
      // , doClaimTransferEventData = balanceAdjustmentRsp['doClaimTransferEventData']
    ;
    console.log("----------------------balanceAdjustmentMap----", JSON.stringify(balanceAdjustmentMap));
    console.log("----------------------txHashTransferEventsMap----", JSON.stringify(txHashTransferEventsMap));
    console.log("----------------------affectedAddresses----", JSON.stringify(affectedAddresses));


    // format data to be inserted into transaction logs
    let params = {
      blockNoDetailsMap: oThis.currentBlockInfo,
      txHashToTxReceiptMap: oThis.txHashToTxReceiptMap,
      erc20ContractAddressesData: erc20ContractAddressesData,
      txHashTransferEventsMap: txHashTransferEventsMap,
      affectedAddresses: affectedAddresses
    };
    let formattedTransactionsData = await oThis._fetchFormattedTransactionsForMigration(params);
    console.log("----------------------formattedTransactionsData----", JSON.stringify(formattedTransactionsData));

    await oThis._insertDataInTransactionLogs(formattedTransactionsData);

    await oThis._settleBalancesInDb(balanceAdjustmentMap);

    // await oThis._claimCompletedStatus(doClaimTransferEventData);

  },

  /**
   * decode events. returns map with key as txHash and value as array of decoded events
   *
   * @returns {promise<result>}
   */
  _decodeTransactionEvents: async function (txHashEventsMap) {
    const oThis = this
    ;

    logger.info('starting _decodeTransactionEvents');

    // Decode events from AbiDecoder
    let txHashDecodedEventsMap = {}
      , txHashes = Object.keys(txHashEventsMap)
    ;

    console.log("-1-------txHashes--", JSON.stringify(txHashes));
    for (let i = 0; i < txHashes.length; i++) {
      let txHash = txHashes[i];
      console.log("-2-------txHash--", JSON.stringify(txHash));
      txHashDecodedEventsMap[txHash] = abiDecoder.decodeLogs(txHashEventsMap[txHash]);
    }

    console.log("-1-------txHashDecodedEventsMap--", JSON.stringify(txHashDecodedEventsMap));
    logger.info('completed _decodeTransactionEvents');

    return txHashDecodedEventsMap;
  },


  /**
   * Update transaction logs table
   */
  updateTransactionLogs: async function () {
    const oThis = this
    ;

    for (var clientId in oThis.clientIdWiseDataToUpdate) {
      const clientTxData = oThis.clientIdWiseDataToUpdate[clientId]
        , txLogObj = new transactionLogModelDdb({
        client_id: clientId,
        ddb_service: ddbServiceObj,
        auto_scaling: autoscalingServiceObj
      });
      for(var i=0; i<clientTxData.length; i++){
        txLogObj.updateItem(clientTxData[i]);
      }
    }
  },

  /**
   * Register interrupt signal handlers
   */
  registerInterruptSignalHandlers: function () {
    const oThis = this;

    process.on('SIGINT', function () {
      logger.win("* Received SIGINT. Signal registerred.");
      oThis.interruptSignalObtained = true;
    });

    process.on('SIGTERM', function () {
      logger.win("* Received SIGTERM. Signal registerred.");
      oThis.interruptSignalObtained = true;
    });
  },

  /**
   * Schedule
   */
  schedule: function () {
    const oThis = this
    ;

    // if the current block is far behind the highest block, schedule for 10 ms otherwise schedule for 2 s
    const waitInterval = (oThis.highestBlock - oThis.INTENTIONAL_BLOCK_DELAY <= oThis.scannerData.lastProcessedBlock) ? 2000 : 10;

    logger.win('* Scheduled checkForNewBlocks after', waitInterval / 1000.0, 'seconds.');

    logger.log('------------------------------------------------');

    setTimeout(
      function () {
        oThis.checkForNewBlocks();
      },
      waitInterval
    );
  },

  /**
   * Re init
   */
  reInit: function () {
    const oThis = this
    ;

    setTimeout(
      function () {
        oThis.init();
      },
      1000
    );
  },

  /**
   * Update scanner data file
   */
  updateScannerDataFile: function () {
    const oThis = this
    ;

    oThis.scannerData.lastProcessedBlock = oThis.currentBlock;

    fs.writeFileSync(
      oThis.filePath,
      JSON.stringify(oThis.scannerData),
      function (err) {
        if (err)
          logger.error(err);
      }
    );

    logger.win('* Updated last processed block = ', oThis.scannerData.lastProcessedBlock);

    if (oThis.interruptSignalObtained) {
      logger.win('* Exiting Process after interrupt signal obtained.');
      process.exit(0);
    }
  },

  /**
   * Get highest block
   */
  refreshHighestBlock: async function () {
    const oThis = this
    ;

    oThis.highestBlock = await oThis.web3Provider.eth.getBlockNumber();

    logger.win('* Obtained highest block:', oThis.highestBlock);

    return Promise.resolve();
  },

  _getEventData: async function (decodedEvents) {
    const eventData = {_tokenAmount: '0', _commissionTokenAmount: '0', transfer_events: []};

    if (!decodedEvents || decodedEvents.length === 0) {
      return eventData;
    }

    let airdropPaymentEventVars = null
      , allTransferEventsVars = []
    ;

    let addressesToFetch = [];

    for (var i = 0; i < decodedEvents.length; i++) {
      if (decodedEvents[i].name == 'AirdropPayment') {
        airdropPaymentEventVars = decodedEvents[i].events;
      }
      if (decodedEvents[i].name == 'Transfer') {
        allTransferEventsVars.push(decodedEvents[i].events);
        for (var j = 0; j < decodedEvents[i].events.length; j ++) {
          if (['_from',  '_to'].includes(decodedEvents[i].events[j].name)) {
            addressesToFetch.push(decodedEvents[i].events[j].value);
          }
        }
      }
    }

    airdropPaymentEventVars = airdropPaymentEventVars || [];

    for (var i = 0; i < airdropPaymentEventVars.length; i++) {
      if (airdropPaymentEventVars[i].name == '_commissionTokenAmount') {
        eventData._commissionTokenAmount = airdropPaymentEventVars[i].value;
      }

      if (airdropPaymentEventVars[i].name == '_tokenAmount') {
        eventData._tokenAmount = airdropPaymentEventVars[i].value;
      }
    }

    console.log("---------------------------allTransferEventsVars------", JSON.stringify(allTransferEventsVars));

    let managedAddressResults = await new ManagedAddressesModel().getByEthAddresses(addressesToFetch);

    let addressToUuidMap = {};

    for (let i = 0; i < managedAddressResults.length; i++) {
      addressToUuidMap[managedAddressResults[i].ethereum_address.toLowerCase()] = managedAddressResults[i].uuid;
    }


    for (var i = 0; i < allTransferEventsVars.length; i++) {
      let transferEventVars = allTransferEventsVars[i];

      let transferEvent = {};

      for (var j = 0; j < transferEventVars.length; j ++) {
        if (transferEventVars[j].name == '_from') {
          transferEvent.from_address = transferEventVars[j].value;
          if (addressToUuidMap[transferEvent.from_address]) {
            transferEvent.from_uuid = addressToUuidMap[transferEvent.from_address];
          }
        }

        if (transferEventVars[j].name == '_to') {
          transferEvent.to_address = transferEventVars[j].value;
          if (addressToUuidMap[transferEvent.to_address]) {
            transferEvent.to_uuid = addressToUuidMap[transferEvent.to_address];
          }
        }

        if (transferEventVars[j].name == '_value') {
          transferEvent.amount_in_wei = transferEventVars[j].value;
        }
      }

      eventData.transfer_events.push(transferEvent);
    }

    return eventData;
  },


  /**
   * computes balance adjustment map. returns map with key as contract address and value as a map
   * which has key as user_eth_address and value as amount to be adjusted
   *
   * @returns {promise<result>}
   */
  _computeBalanceAdjustments: async function (txHashDecodedEventsMap, erc20ContractAddressesData) {
    const oThis = this
    ;

    logger.info('starting _computeBalanceAdjustments');

    let balanceAdjustmentMap = {}
      , txHashTransferEventsMap = {}
      , affectedAddresses = []
      // , doClaimTransferEventData = []
      , txHashes = Object.keys(txHashDecodedEventsMap)
    ;

    for (let k = 0; k < txHashes.length; k++) {

      let txHash = txHashes[k];

      let decodedEventsMap = txHashDecodedEventsMap[txHash]
        , transferEvents = []
      ;

      for (let i = 0; i < decodedEventsMap.length; i++) {

        let decodedEventData = decodedEventsMap[i]
          , contractAddress = decodedEventData.address.toLowerCase()
        ;

        let fromAddr = null
          , toAddr = null
          , valueStr = null
          // , contractUuid = null
          // , claimDone = false;
        ;

        for (let j = 0; j < decodedEventData.events.length; j++) {
          let eventData = decodedEventData.events[j];
          switch (eventData.name) {
            case "_from": //case "_staker":
              fromAddr = eventData.value.toLowerCase();
              break;
            case "_to": //case "_beneficiary":
              toAddr = eventData.value.toLowerCase();
              break;
            case "_value":
            // case "_amount":
              valueStr = eventData.value;
              break;
            // case "_uuid":
            //   contractUuid = eventData.value.toLowerCase();
            //   break;
          }
        }

        //This identifies that balance is transfered from erc20 address(fromAddr) to reserve address(toAddr) on claim success.
        // if(contractAddress == fromAddr){
        //   const erc20AddrData = erc20ContractAddressesData[contractAddress];
        //   if(erc20AddrData.client_id){
        //     doClaimTransferEventData.push({client_id: erc20AddrData.client_id, transaction_hash: txHash});
        //     claimDone = true;
        //   }
        // }

        // if (contractUuid) {
        //   // it is not an transfer event but is a mint event
        //   if (contractUuid === oThis.StPrimeContractUuid) {
        //     // for St prime uuid do not settle balances
        //     continue;
        //   } else {
        //     let cacheObj = new Erc20ContractUuidCacheKlass({uuids: [contractUuid]})
        //       , cacheFetchRsp = await cacheObj.fetch()
        //     ;
        //     if (cacheFetchRsp.isFailure()) {
        //       return Promise.reject(cacheFetchRsp)
        //     }
        //     let erc20ContractUuidsData = cacheFetchRsp.data;
        //     // overridr contractAddress of ostutility contract with that of erc 20 address of this token
        //     contractAddress = erc20ContractUuidsData[contractUuid]['token_erc20_address'].toLowerCase();
        //     switch (decodedEventData.name) {
        //       case "ProcessedMint":
        //         toAddr = contractAddress;
        //         break;
        //       case "RevertedMint":
        //         fromAddr = contractAddress;
        //         break;
        //       default:
        //         return Promise.reject(responseHelper.error({
        //           internal_error_identifier: 'e_drdm_ads_2',
        //           api_error_identifier: 'unhandled_catch_response',
        //           debug_options: {}
        //         }));
        //         break;
        //     }
        //   }
        // }

        transferEvents.push({
          from_address: fromAddr,
          to_address: toAddr,
          amount_in_wei: valueStr
        });

        if(fromAddr === contractAddress) {
          // if from == contract this tx event is then of claim by beneficiary. This was credited by platform so ignore here
          continue;
        }

        let valueBn = new BigNumber(valueStr);
        balanceAdjustmentMap[contractAddress] = balanceAdjustmentMap[contractAddress] || {};

        if (fromAddr) {
          balanceAdjustmentMap[contractAddress][fromAddr] = balanceAdjustmentMap[contractAddress][fromAddr] || {settledBalance: new BigNumber('0'), unSettledDebit: new BigNumber('0')};
          balanceAdjustmentMap[contractAddress][fromAddr].settledBalance = balanceAdjustmentMap[contractAddress][fromAddr].settledBalance.minus(valueBn);
          // if(!claimDone){
          //   balanceAdjustmentMap[contractAddress][fromAddr].unSettledDebit = balanceAdjustmentMap[contractAddress][fromAddr].unSettledDebit.minus(valueBn);
          // }
          affectedAddresses.push(fromAddr);
        }

        if (toAddr) {
          balanceAdjustmentMap[contractAddress][toAddr] = balanceAdjustmentMap[contractAddress][toAddr] || {settledBalance: new BigNumber('0'), unSettledDebit: new BigNumber('0')};
          balanceAdjustmentMap[contractAddress][toAddr].settledBalance = balanceAdjustmentMap[contractAddress][toAddr].settledBalance.plus(valueBn);
          affectedAddresses.push(toAddr);
        }

      }

      txHashTransferEventsMap[txHash] = transferEvents;

      // uniq!
      affectedAddresses = affectedAddresses.filter(function (item, pos) {
        return affectedAddresses.indexOf(item) == pos;
      });

    }

    logger.info('completed _computeBalanceAdjustments');

    return {
      balanceAdjustmentMap: balanceAdjustmentMap,
      txHashTransferEventsMap: txHashTransferEventsMap,
      affectedAddresses: affectedAddresses,
      // doClaimTransferEventData: doClaimTransferEventData
    };

  },

  /**
   * from all the data we have fetched till now, format it to a format which could be directly inserted in DDB.
   *
   * @returns {promise<result>}
   */
  _fetchFormattedTransactionsForMigration: async function (params) {

    console.log("-1111--------------------params---", JSON.stringify(params));
    logger.info('starting _fetchFormattedTransactionsForMigration');

    let blockNoDetails = params['blockNoDetailsMap']
      , txHashToTxReceiptMap = params['txHashToTxReceiptMap']
      , erc20ContractAddressesData = params['erc20ContractAddressesData']
      , txHashTransferEventsMap = params['txHashTransferEventsMap']
      , affectedAddresses = params['affectedAddresses']
      , addressUuidMap = {}
      , formattedTransactionsData = {}
      , completeStatus = parseInt(new TransactionLogModel().invertedStatuses[transactionLogConst.completeStatus])
      , failedStatus = parseInt(new TransactionLogModel().invertedStatuses[transactionLogConst.failedStatus])
      , tokenTransferType = parseInt(new TransactionLogModel().invertedTransactionTypes[transactionLogConst.extenralTokenTransferTransactionType])
    ;

    console.log("-2222--------------------addressUuidMap---", JSON.stringify(addressUuidMap));
    if (affectedAddresses.length > 0) {
      let dbRows = await new ManagedAddressModel().getByEthAddresses(affectedAddresses);
      for (let i = 0; i < dbRows.length; i++) {
        let dbRow = dbRows[i];
        addressUuidMap[dbRow['ethereum_address'].toLowerCase()] = dbRow['uuid'];
      }
    }

    console.log("-3333--------------------addressUuidMap---", JSON.stringify(addressUuidMap));
      let txHashes = Object.keys(txHashTransferEventsMap);

      for (let i = 0; i < txHashes.length; i++) {

        let txHash = txHashes[i]
          , txFormattedData = {}
          , txDataFromChain = txHashToTxReceiptMap[txHash]
        ;

        let contractAddress = txDataFromChain.logs[0].address
          , erc20ContractAddressData = erc20ContractAddressesData[contractAddress.toLowerCase()]
        ;

        if (!erc20ContractAddressData) {
          // as we are also processing mint events, they wouldn't have client id.
          // they should only be used to adjust balances but not insert here
          continue;
        }

        txFormattedData = {
          transaction_hash: txHash,
          transaction_uuid: uuid.v4(),
          transaction_type: tokenTransferType,
          block_number: txDataFromChain['blockNumber'],
          client_id: parseInt(erc20ContractAddressData['client_id']),
          client_token_id: parseInt(erc20ContractAddressData['client_token_id']),
          token_symbol: erc20ContractAddressData['symbol'],
          gas_used: txDataFromChain['gasUsed'],
          status: (parseInt(txDataFromChain.status, 16) == 1) ? completeStatus : failedStatus,
          created_at: blockNoDetails['timestamp'],
          updated_at: blockNoDetails['timestamp'],
          from_address: txDataFromChain['from'],
          to_address: txDataFromChain['to']
        };

        let fromUuid = addressUuidMap[txDataFromChain['from'].toLowerCase()];
        if (!commonValidator.isVarNull(fromUuid)) {
          txFormattedData['from_uuid'] = fromUuid
        }

        let toUuid = addressUuidMap[txDataFromChain['to'].toLowerCase()];
        if (!commonValidator.isVarNull(toUuid)) {
          txFormattedData['to_uuid'] = toUuid
        }


        if (txHashTransferEventsMap[txHash]) {
          txFormattedData['transfer_events'] = txHashTransferEventsMap[txHash];
          for (let j = 0; j < txFormattedData['transfer_events'].length; j++) {
            let event_data = txFormattedData['transfer_events'][j];
            let fromUuid = addressUuidMap[event_data['from_address']];
            if (!commonValidator.isVarNull(fromUuid)) {
              event_data['from_uuid'] = fromUuid
            }
            let toUuid = addressUuidMap[event_data['to_address']];
            if (!commonValidator.isVarNull(toUuid)) {
              event_data['to_uuid'] = toUuid
            }
          }
        }

        // group data by client_ids so that they can be batch inserted in ddb
        formattedTransactionsData[txFormattedData['client_id']] = formattedTransactionsData[txFormattedData['client_id']] || [];

        formattedTransactionsData[txFormattedData['client_id']].push(txFormattedData);

      }

    logger.info('completed _fetchFormattedTransactionsForMigration');

    return Promise.resolve(formattedTransactionsData);
  },

  /**
   * bulk create records in DDB
   *
   * @returns {promise<result>}
   */
  _insertDataInTransactionLogs: async function (formattedTransactionsData) {
    const oThis = this;

    logger.info('starting _insertDataInTransactionLogs');

    let clientIds = Object.keys(formattedTransactionsData)
    ;

    for (let k = 0; k < clientIds.length; k++) {

      let clientId = clientIds[k]
        , dataToInsert = formattedTransactionsData[clientId]
      ;

      logger.info(`starting _insertDataInTransactionLogs clientId : ${clientId} length : ${dataToInsert.length}`);

      let rsp = await new transactionLogModelDdb({
        client_id: clientId,
        ddb_service: ddbServiceObj,
        auto_scaling: autoscalingServiceObj
      }).batchPutItem(dataToInsert, 10);

    }

    logger.info('completed _insertDataInTransactionLogs');

    return Promise.resolve({});

  },

  /**
   * settle balances in DB
   *
   * @returns {promise<result>}
   */
  _settleBalancesInDb: async function (balanceAdjustmentMap) {

    const oThis = this;

    logger.info('starting _settleBalancesInDb');

    let erc20ContractAddresses = Object.keys(balanceAdjustmentMap);

    for (let k = 0; k < erc20ContractAddresses.length; k++) {

      let erc20ContractAddress = erc20ContractAddresses[k];

      let userBalancesSettlementsData = balanceAdjustmentMap[erc20ContractAddress]
        , tokenalanceModelObj = new tokenBalanceModelDdb({
          erc20_contract_address: erc20ContractAddress,
          chain_id: chainInteractionConstants.UTILITY_CHAIN_ID,
          ddb_service: ddbServiceObj,
          auto_scaling: autoscalingServiceObj
        })
        , promises = []
        , userAddresses = Object.keys(userBalancesSettlementsData)
      ;

      for (var l = 0; l < userAddresses.length; l++) {

        let userAddress = userAddresses[l]
          , settledAmountDelta = userBalancesSettlementsData[userAddress].settledBalance
          , unsettledDebitDelta = userBalancesSettlementsData[userAddress].unSettledDebit || '0'
        ;

        promises.push(tokenalanceModelObj.update({
          settle_amount: settledAmountDelta.toString(10),
          un_settled_debit_amount: unsettledDebitDelta.toString(10),
          ethereum_address: userAddress
        }).catch(oThis.catchHandlingFunction));

      }

      await Promise.all(promises);

    }

    logger.info('completed _settleBalancesInDb');

    return Promise.resolve({});

  },

  /**
   * if claim event found raise one RMQ event. Which will mark stake_and_mint for bt completed.
   *
   * @returns {object}
   */
  // _claimCompletedStatus: async function (doClaimTransferEventData) {
  //   const oThis = this
  //   ;
  //
  //   logger.info('starting _claimCompletedStatus for -- ', JSON.stringify(doClaimTransferEventData));
  //
  //   for(var i=0; i<doClaimTransferEventData.length; i++){
  //
  //     // fire settled_balance event to mark bt stake_and_mint process done.
  //     const notificationData = {
  //         topics: [notificationTopics.settleTokenBalanceOnUcDone],
  //         publisher: 'OST',
  //         message: {
  //           kind: 'info',
  //           payload: {
  //             client_id: doClaimTransferEventData[i].client_id,
  //             status: 'settle_token_balance_on_uc_done',
  //             transaction_hash: doClaimTransferEventData[i].transaction_hash
  //           }
  //         }
  //     };
  //
  //     const publishEventResp = await openSTNotification.publishEvent.perform(notificationData);
  //     console.log("------------------------publishEventResp-", JSON.stringify(publishEventResp));
  //
  //   }
  //
  //   logger.info('Done _claimCompletedStatus');
  //
  // },

  /**
   * generic function to handle catch blocks
   *
   * @returns {object}
   */
  catchHandlingFunction: async function (error) {
    if (responseHelper.isCustomResult(error)) {
      logger.error(error.toHash());
      return error;
    } else {
      logger.error(`${__filename}::perform::catch`);
      logger.error(error);
      return responseHelper.error({
        internal_error_identifier: 'e_drdm_mdfctb_2',
        api_error_identifier: 'something_went_wrong',
        debug_options: {},
        error_config: errorConfig
      });
    }
  }

};

const usageDemo = function () {
  logger.log('usage:', 'node ./executables/block_scanner/for_tx_status_and_balance_sync.js processLockId datafilePath');
  logger.log('* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.');
  logger.log('* datafilePath is the path to the file which is storing the last block scanned info.');
};

const ProcessLockerKlass = require(rootPrefix + '/lib/process_locker')
;

const ProcessLocker = new ProcessLockerKlass()
  , args = process.argv
  , processLockId = args[2]
  , datafilePath = args[3]
;

ProcessLocker.canStartProcess({process_title: 'executables_block_scanner_execute_transaction' + processLockId});

const validateAndSanitize = function () {
  if (!processLockId) {
    logger.error('Process Lock id NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!datafilePath) {
    logger.error('Data file path is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

const blockScannerObj = new BlockScannerForTxStatusAndBalanceSync({file_path: datafilePath});
blockScannerObj.registerInterruptSignalHandlers();
blockScannerObj.init();