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
  , commonValidator = require(rootPrefix + '/lib/validators/common')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , ManagedAddressesModel = require(rootPrefix + '/app/models/managed_address')
;

const PostAirdropPayKlass = openStPayments.services.airdropManager.postAirdropPay
  , transactionLogModelDdb = openStorage.TransactionLogModel
  , tokenBalanceModelDdb = openStorage.TokenBalanceModel
  , StorageEntityTypesConst = openStorage.StorageEntityTypesConst
  , coreAbis = openStPlatform.abis
;

abiDecoder.addABI(coreAbis.airdrop);
abiDecoder.addABI(coreAbis.brandedToken);

const BlockScannerForTxStatusAndBalanceSync = function (params) {
  const oThis = this
  ;

  oThis.filePath = params.file_path;
  oThis.benchmarkFilePath = params.benchmark_file_path;
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
        console.log("---------------------------------------------------starts------------1--", Date.now()-oThis.startTime, 'ms');

        console.log("---------------------------------------------------initParams------------2--", Date.now()-oThis.startTime, 'ms');
        await oThis.refreshHighestBlock();

        console.log("---------------------------------------------------refreshHighestBlock------------3--", Date.now()-oThis.startTime, 'ms');
        // return if nothing more to do, as of now.
        if (oThis.highestBlock - oThis.INTENTIONAL_BLOCK_DELAY <= oThis.scannerData.lastProcessedBlock) return oThis.schedule();

        oThis.currentBlock = oThis.scannerData.lastProcessedBlock + 1;

        logger.log('Current Block =', oThis.currentBlock);

        oThis.currentBlockInfo = await oThis.web3Provider.eth.getBlock(oThis.currentBlock);
        console.log('block no-', oThis.currentBlock, "--------------------------------------------------get-currentBlockInfo------------4--", Date.now()-oThis.startTime, 'ms');

        if (!oThis.currentBlockInfo) return oThis.schedule();

        // categorize the transaction hashes into known (having entry in transaction meta) and unknown
        await oThis.categorizeTransactions();

        console.log('block no-', oThis.currentBlock, "--------------------------------------------------categorizeTransactions------------5--", Date.now()-oThis.startTime, 'ms');
        // for all the transactions in the block, get the receipt
        await oThis.getTransactionReceipts();
        console.log('block no-', oThis.currentBlock, "--------------------------------------------------getTransactionReceipts------------6--", Date.now()-oThis.startTime, 'ms');

        // construct the data to be updated for known transaction
        await oThis.generateToUpdateDataForKnownTx();
        console.log('block no-', oThis.currentBlock, "--------------------------------------------------generateToUpdateDataForKnownTx------------7--", Date.now()-oThis.startTime, 'ms');

        // construct the data to be inserted for unknown transaction
        await oThis.generateToUpdateDataForUnKnownTx();
        console.log('block no-', oThis.currentBlock, "--------------------------------------------------generateToUpdateDataForUnKnownTx------------8--", Date.now()-oThis.startTime, 'ms');
        await oThis.updateTransactionLogs();
        console.log('block no-', oThis.currentBlock, "--------------------------------------------------updateTransactionLogs------------9--", Date.now()-oThis.startTime, 'ms');

        oThis.updateScannerDataFile();
        console.log('block no-', oThis.currentBlock, "--------------------------------------------------updateScannerDataFile------------11--", Date.now()-oThis.startTime, 'ms');

        if (oThis.recognizedTxHashes.length != 0) {
          if (oThis.benchmarkFilePath) {
            oThis.updateBanchmarkFile();
          }
        }

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

    oThis.startTime = Date.now();
    oThis.tokenTransferTxHashesMap = {};
    oThis.txUuidToPostReceiptProcessParamsMap = {};
    oThis.recognizedTxUuidsGroupedByClientId = {};
    oThis.recognizedTxHashes = [];
    oThis.knownTxUuidToTxHashMap = {};
    oThis.txHashToTxReceiptMap = {};
    oThis.dataToUpdate = [];
    oThis.clientIdsMap = {};
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
          oThis.txUuidToPostReceiptProcessParamsMap[currRecord.transaction_uuid] = currRecord.post_receipt_process_params;
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

      for (var i = 0; i < batchedTxHashes.length; i++) {
        //if already known transaction skip here.
        if (recognizedTxHashesMap[batchedTxHashes[i]]) continue;
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
      , batchSize = 100
    ;

    for (var clientId in oThis.recognizedTxUuidsGroupedByClientId) {
      let txUuids = oThis.recognizedTxUuidsGroupedByClientId[clientId]
        , batchNo = 1
      ;
      console.log('block no-', oThis.currentBlock, "---clientId-", clientId, "--a1------------------------------------------------------------6--", Date.now()-oThis.startTime, 'ms');

      oThis.clientIdsMap[clientId] = 1;

      while (true) {
        const offset = (batchNo - 1) * batchSize
          , batchedTxUuids = txUuids.slice(offset, batchSize + offset)
        ;

        console.log('block no-', oThis.currentBlock, "---clientId-", clientId, "--batchNo-", batchNo,"--a2------------------------------------------------------------6--", Date.now()-oThis.startTime, 'ms');

        batchNo = batchNo + 1;

        if (batchedTxUuids.length === 0) break;

        for (var txUuidIndex=0; txUuidIndex<batchedTxUuids.length; txUuidIndex++) {

          let txUuid = batchedTxUuids[txUuidIndex];
          console.log('block no-', oThis.currentBlock, "---clientId-", clientId, "--txUuid-", txUuid,"--a3------------------------------------------------------------6--", Date.now()-oThis.startTime, 'ms');

          let txHash = oThis.knownTxUuidToTxHashMap[txUuid];
          let txReceipt = oThis.txHashToTxReceiptMap[txHash];

          let toUpdateFields = {}
            , eventData = {};

          console.log('block no-', oThis.currentBlock, "---clientId-", clientId, "--txUuid-", txUuid,"--a4------------------------------------------------------------6--", Date.now()-oThis.startTime, 'ms');
          if (oThis.tokenTransferTxHashesMap[txHash]) {
            const decodedEvents = abiDecoder.decodeLogs(txReceipt.logs);
            console.log('block no-', oThis.currentBlock, "---clientId-", clientId, "--txUuid-", txUuid,"--a44------------------------------------------------------------6--", Date.now()-oThis.startTime, 'ms');

            let postAirdropParams = oThis.txUuidToPostReceiptProcessParamsMap[txUuid];

            console.log('--111111111111111------postAirdropParams--', JSON.stringify(postAirdropParams));
            if (postAirdropParams) {
              postAirdropParams = JSON.parse(postAirdropParams);
              console.log('--------postAirdropParams--', JSON.stringify(postAirdropParams));
              const postAirdropPay = new PostAirdropPayKlass(postAirdropParams, decodedEvents, txReceipt.status);
              await postAirdropPay.perform();
            }

            console.log('block no-', oThis.currentBlock, "---clientId-", clientId, "--txUuid-", txUuid,"--a5------------------------------------------------------------6--", Date.now()-oThis.startTime, 'ms');
            eventData = await oThis._getEventData(decodedEvents);
            console.log('block no-', oThis.currentBlock, "---clientId-", clientId, "--txUuid-", txUuid,"--a6------------------------------------------------------------6--", Date.now()-oThis.startTime, 'ms');

            toUpdateFields = {
              commission_amount_in_wei: eventData._commissionTokenAmount,
              amount_in_wei: eventData._tokenAmount
            };
          }
          console.log('block no-', oThis.currentBlock, "---clientId-", clientId, "--txUuid-", txUuid,"--a7------------------------------------------------------------6--", Date.now()-oThis.startTime, 'ms');

          toUpdateFields.transaction_uuid = txUuid;
          if (eventData.transfer_events) {
            toUpdateFields.transfer_events = eventData.transfer_events
          }
          toUpdateFields.post_receipt_process_params = null;
          toUpdateFields.gas_used = txReceipt.gasUsed;
          toUpdateFields.block_number = txReceipt.blockNumber;
          toUpdateFields.status = parseInt(txReceipt.status, 16) == 1 ? oThis.completeTxStatus : oThis.failedTxStatus;
          console.log('block no-', oThis.currentBlock, "---clientId-", clientId, "--txUuid-", txUuid,"--a8------------------------------------------------------------6--", Date.now()-oThis.startTime, 'ms');

          oThis.dataToUpdate.push({client_id: clientId, data: toUpdateFields});

        }
      }
    }
  },

  /**
   * Generate to update data for unrecognized transaction if it belongs to us.
   */
  generateToUpdateDataForUnKnownTx: async function () {
    const oThis = this
      , eventGeneratingContractAddresses = []
      , txHashToShortListedEventsMap = {}
    ;

    let erc20ContractAddressesData = {}
    ;

    for (var i = 0; i < oThis.unRecognizedTxHashes.length; i++) {
      let txHash = oThis.unRecognizedTxHashes[i]
        , txReceipt = oThis.txHashToTxReceiptMap[txHash]
      ;

      for (var j = 0; j < txReceipt.logs.length; j++) {
        eventGeneratingContractAddresses.push(txReceipt.logs[j].address);
      }
    }

    if (eventGeneratingContractAddresses.length > 0) {
      // from these addresses create a map of addresses of which are ERC20 address
      let cacheObj = new Erc20ContractAddressCacheKlass({addresses: eventGeneratingContractAddresses})
        , cacheFetchRsp = await cacheObj.fetch()
      ;
      if (cacheFetchRsp.isFailure()) {
        return Promise.reject(cacheFetchRsp)
      }
      erc20ContractAddressesData = cacheFetchRsp.data;
    }

    for (var i = 0; i < oThis.unRecognizedTxHashes.length; i++) {
      let txHash = oThis.unRecognizedTxHashes[i];
      let txReceipt = oThis.txHashToTxReceiptMap[txHash];

      for (var j = 0; j < txReceipt.logs.length; j++) {
        let txReceiptLogElement = txReceipt.logs[j]
          , contractAddress = txReceiptLogElement.address.toLowerCase()
          , eventSignature = txReceiptLogElement.topics[0]
          , isKnownBTContract = erc20ContractAddressesData[contractAddress]
          , isTransferEvent = (eventSignature === oThis.TransferEventSignature)
        ;

        if ((isKnownBTContract && isTransferEvent)) {
          txHashToShortListedEventsMap[txHash] = txHashToShortListedEventsMap[txHash] || [];
          txHashToShortListedEventsMap[txHash].push(txReceiptLogElement);
        }
      }
    }

    let txHashDecodedEventsMap = await oThis._decodeTransactionEvents(txHashToShortListedEventsMap);

    let balanceAdjustmentRsp = await oThis._computeBalanceAdjustments(txHashDecodedEventsMap, erc20ContractAddressesData);
    let balanceAdjustmentMap = balanceAdjustmentRsp['balanceAdjustmentMap']
      , txHashTransferEventsMap = balanceAdjustmentRsp['txHashTransferEventsMap']
      , affectedAddresses = balanceAdjustmentRsp['affectedAddresses']
    ;

    // format data to be inserted into transaction logs
    let params = {
      blockNoDetailsMap: oThis.currentBlockInfo,
      txHashToTxReceiptMap: oThis.txHashToTxReceiptMap,
      erc20ContractAddressesData: erc20ContractAddressesData,
      txHashTransferEventsMap: txHashTransferEventsMap,
      affectedAddresses: affectedAddresses
    };
    let formattedTransactionsData = await oThis._fetchFormattedTransactionsForMigration(params);

    await oThis._insertDataInTransactionLogs(formattedTransactionsData);

    await oThis._settleBalancesInDb(balanceAdjustmentMap);
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

    for (let i = 0; i < txHashes.length; i++) {
      let txHash = txHashes[i];
      txHashDecodedEventsMap[txHash] = abiDecoder.decodeLogs(txHashEventsMap[txHash]);
    }

    logger.info('completed _decodeTransactionEvents');

    return txHashDecodedEventsMap;
  },

  /**
   * Update transaction logs table
   */
  updateTransactionLogs: async function () {
    const oThis = this
    ;

    console.log('-------oThis.clientIdsMap----', JSON.stringify(oThis.clientIdsMap));

    if(Object.keys(oThis.clientIdsMap) == 0) return {};

    const getManagedShardResponse = await ddbServiceObj.shardManagement().getManagedShard({
      entity_type: StorageEntityTypesConst.transactionLogEntityType,
      identifiers: Object.keys(oThis.clientIdsMap)
    });

    console.log('-------getManagedShardResponse----', JSON.stringify(getManagedShardResponse));

    if (getManagedShardResponse.isFailure()) return Promise.reject(getManagedShardResponse);

    let promiseArray = []
      , batchNo = 1
      , dynamoQueryBatchSize = 10
      , clientIdToTxLogModelObjectMap = {}
    ;

    while(true){

      let offset = (batchNo - 1) * dynamoQueryBatchSize
        , batchedData = oThis.dataToUpdate.slice(offset, dynamoQueryBatchSize + offset)
      ;

      if(batchedData.length == 0) break;

      for(var i=0; i<batchedData.length; i++){
        let toProcessData = batchedData[i]
          , clientId = toProcessData.client_id
          , shardName = getManagedShardResponse.data.items[clientId].shardName
        ;

        clientIdToTxLogModelObjectMap[clientId] = clientIdToTxLogModelObjectMap[clientId] || new transactionLogModelDdb({
            client_id: clientId,
            ddb_service: ddbServiceObj,
            auto_scaling: autoscalingServiceObj,
            shard_name: shardName
          });

        promiseArray.push(clientIdToTxLogModelObjectMap[clientId].updateItem(toProcessData.data));

      }

      await Promise.all(promiseArray);

      // Resetting batch iteration variables.
      promiseArray = [];
      batchNo = batchNo + 1;

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
   * Update executation statistics to benchmark file.
   */
  updateBanchmarkFile: function () {
    const oThis = this
    ;
    const benchmarkData = [oThis.currentBlock, (Date.now() - oThis.startTime), oThis.currentBlockInfo.transactions.length,
      oThis.recognizedTxHashes.length, oThis.unRecognizedTxHashes.length];

    fs.appendFileSync(
      oThis.benchmarkFilePath,
      benchmarkData.join(',')+'\n',
      function (err) {
        if (err)
          logger.error(err);
      }
    );
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

  /**
   * Get event data
   */
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
        for (var j = 0; j < decodedEvents[i].events.length; j++) {
          if (['_from', '_to'].includes(decodedEvents[i].events[j].name)) {
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

    logger.debug("---------------------------allTransferEventsVars------", allTransferEventsVars);

    let managedAddressResults = await new ManagedAddressesModel().getByEthAddresses(addressesToFetch);

    let addressToUuidMap = {};

    for (let i = 0; i < managedAddressResults.length; i++) {
      addressToUuidMap[managedAddressResults[i].ethereum_address.toLowerCase()] = managedAddressResults[i].uuid;
    }


    for (var i = 0; i < allTransferEventsVars.length; i++) {
      let transferEventVars = allTransferEventsVars[i];

      let transferEvent = {};

      for (var j = 0; j < transferEventVars.length; j++) {
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
              valueStr = eventData.value;
              break;
          }
        }

        transferEvents.push({
          from_address: fromAddr,
          to_address: toAddr,
          amount_in_wei: valueStr
        });

        if (fromAddr === contractAddress) {
          // if from == contract this tx event is then of claim by beneficiary. This was credited by platform so ignore here
          continue;
        }

        let valueBn = new BigNumber(valueStr);
        balanceAdjustmentMap[contractAddress] = balanceAdjustmentMap[contractAddress] || {};

        if (fromAddr) {
          balanceAdjustmentMap[contractAddress][fromAddr] = balanceAdjustmentMap[contractAddress][fromAddr] || {
            settledBalance: new BigNumber('0'),
            unSettledDebit: new BigNumber('0')
          };
          balanceAdjustmentMap[contractAddress][fromAddr].settledBalance = balanceAdjustmentMap[contractAddress][fromAddr].settledBalance.minus(valueBn);
          // TODO: This is being happening for unrecognized, but this can happen outside SaaS also
          balanceAdjustmentMap[contractAddress][fromAddr].unSettledDebit = balanceAdjustmentMap[contractAddress][fromAddr].unSettledDebit.minus(valueBn);
          // if(!claimDone){
          //   balanceAdjustmentMap[contractAddress][fromAddr].unSettledDebit = balanceAdjustmentMap[contractAddress][fromAddr].unSettledDebit.minus(valueBn);
          // }
          affectedAddresses.push(fromAddr);
        }

        if (toAddr) {
          balanceAdjustmentMap[contractAddress][toAddr] = balanceAdjustmentMap[contractAddress][toAddr] || {
            settledBalance: new BigNumber('0'),
            unSettledDebit: new BigNumber('0')
          };
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

    logger.debug("-1111--------------------params---", params);
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
      ,
      tokenTransferType = parseInt(new TransactionLogModel().invertedTransactionTypes[transactionLogConst.extenralTokenTransferTransactionType])
    ;

    logger.debug("-2222--------------------addressUuidMap---", addressUuidMap);
    if (affectedAddresses.length > 0) {
      let dbRows = await new ManagedAddressModel().getByEthAddresses(affectedAddresses);
      for (let i = 0; i < dbRows.length; i++) {
        let dbRow = dbRows[i];
        addressUuidMap[dbRow['ethereum_address'].toLowerCase()] = dbRow['uuid'];
      }
    }

    logger.debug("-3333--------------------addressUuidMap---", addressUuidMap);
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
  , benchmarkFilePath = args[4]
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

const blockScannerObj = new BlockScannerForTxStatusAndBalanceSync({file_path: datafilePath, benchmark_file_path: benchmarkFilePath});
blockScannerObj.registerInterruptSignalHandlers();
blockScannerObj.init();