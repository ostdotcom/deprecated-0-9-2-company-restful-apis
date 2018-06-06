"use strict";

/**
 * This is the base class for block scanners
 *
 * @module executables/ddb_related_data_migrations/migrate_token_balances_data
 *
 */

const Web3 = require('web3')
  , abiDecoder = require('abi-decoder')
  , openStPlatform = require('@openstfoundation/openst-platform')
  , openStorage = require('@openstfoundation/openst-storage')
  , BigNumber = require('bignumber.js')
  , uuid = require('uuid')
;

const coreAbis = openStPlatform.abis
;

abiDecoder.addABI(coreAbis.brandedToken);
abiDecoder.addABI(coreAbis.openSTUtility);

const rootPrefix = '../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , TransactionLogModelDdb = openStorage.TransactionLogModel
  , TokenBalanceModelDdb = openStorage.TokenBalanceModel
  , TransactionLogConst = openStorage.TransactionLogConst
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , Erc20ContractAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/erc20_contract_address')
  , Erc20ContractUuidCacheKlass = require(rootPrefix + '/lib/cache_multi_management/erc20_contract_uuid')
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , autoscalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
;

const MigrateTokenBalancesKlass = function (params) {

  const oThis = this
  ;

  oThis.startBlockNo = params.start_block_no;
  oThis.endBlockNo = params.end_block_no;

  oThis.web3Provider = new Web3(chainInteractionConstants.UTILITY_GETH_WS_PROVIDER);

  oThis.TransferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  oThis.ProcessedMintEventSignature = '0x96989a6b1d8c3bb8d6cc22e14b188b5c14b1f33f34ff07ea2e4fd6d880dac2c7';
  oThis.RevertedMintEventSignature = '0x86e6b95641fbf0f8939eb3da2e7e26aee0188048353d08a45c78218e84cf1d4f';

  oThis.parallelBlocksToProcessCnt = 10;
  oThis.blockNoArray = [];

  oThis.OpenSTUtilityContractAddr = chainInteractionConstants.OPENSTUTILITY_CONTRACT_ADDR.toLowerCase();
  oThis.StPrimeContractUuid = chainInteractionConstants.ST_PRIME_UUID.toLowerCase();
  oThis.ZeroXAddress = '0x0000000000000000000000000000000000000000';

};

MigrateTokenBalancesKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise}
   */
  perform: function () {
    const oThis = this
    ;

    return oThis.asyncPerform()
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 'e_drdm_ads_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  /**
   * Starts the process of the script
   *
   * @returns {promise<result>}
   */
  asyncPerform: async function () {
    const oThis = this
    ;

    await oThis._generateBlockNoArray();

    let batchNo = 1;

    while (true) {

      const offset = (batchNo - 1) * oThis.parallelBlocksToProcessCnt
        , batchedBlockNumbers = oThis.blockNoArray.slice(offset, oThis.parallelBlocksToProcessCnt + offset)
      ;

      if (batchedBlockNumbers.length === 0) break;

      logger.info(`starting processing for batch: ${batchNo} with block numbers ${JSON.stringify(batchedBlockNumbers)}`);

      await oThis._processBlocks(batchedBlockNumbers);

      batchNo = batchNo + 1;

    }

  },

  /**
   * generate block numbers array
   *
   * @returns {promise}
   */
  _generateBlockNoArray: async function () {
    const oThis = this
    ;

    for (let blockNo = oThis.startBlockNo; blockNo <= oThis.endBlockNo; blockNo++) {
      oThis.blockNoArray.push(blockNo);
    }

    return Promise.resolve({});
  },

  /**
   * process blocks
   * @param blockNumbers {array<number>} - array of block numbers to process
   * @returns {promise<result>}
   */
  _processBlocks: async function (blockNumbers) {

    const oThis = this;

    // fetch transaction hashes
    let fetchBlockDetailsRsp = await oThis._fetchBlockDetails(blockNumbers);
    if (fetchBlockDetailsRsp.isFailure()) {
      console.error('fetchBlockDetailsRsp', JSON.strinfigy(fetchBlockDetailsRsp.toHash()));
      return Promise.reject(fetchBlockDetailsRsp);
    }

    let batchBlockTxHashes = fetchBlockDetailsRsp.data['txHashes']
      , blockNoDetailsMap = fetchBlockDetailsRsp.data['blockNoDetailsMap']
    ;

    // console.log('txHashes', txHashes);
    // console.log('blockNoDetailsMap', blockNoDetailsMap);

    // fetch transaction receipts
    let fetchTransactionReceiptRsp = await oThis._fetchTransactionReceipts(batchBlockTxHashes);
    if (fetchTransactionReceiptRsp.isFailure()) {
      console.error('fetchTransactionReceiptRsp', JSON.strinfigy(fetchTransactionReceiptRsp.toHash()));
      return Promise.reject(fetchTransactionReceiptRsp);
    }

    let txHashToTxReceiptMap = fetchTransactionReceiptRsp.data['txHashToTxReceiptMap'];

    // console.log('txHashToTxReceiptMap', txHashToTxReceiptMap);

    // fetch transactions to shortlisted events map
    let shortListTransactionEventRsp = await oThis._shortListTransactionEvents(txHashToTxReceiptMap);
    if (shortListTransactionEventRsp.isFailure()) {
      console.error('shortListTransactionEventRsp', JSON.strinfigy(shortListTransactionEventRsp.toHash()));
      return Promise.reject(shortListTransactionEventRsp);
    }

    let txHashShortListedEventsMap = shortListTransactionEventRsp.data['txHashShortListedEventsMap']
      , erc20ContractAddressesData = shortListTransactionEventRsp.data['erc20ContractAddressesData']
    ;

    // console.log('txHashShortListedEventsMap', txHashShortListedEventsMap);
    // console.log('erc20ContractAddressesData', erc20ContractAddressesData);

    // decode shortlisted events
    let decodeEventRsp = await oThis._decodeTransactionEvents(txHashShortListedEventsMap);
    if (decodeEventRsp.isFailure()) {
      console.error('decodeEventRsp', JSON.strinfigy(decodeEventRsp.toHash()));
      return Promise.reject(decodeEventRsp);
    }

    let txHashDecodedEventsMap = decodeEventRsp.data['txHashDecodedEventsMap'];

    // console.log('txHashDecodedEventsMap', txHashDecodedEventsMap);

    // iterate over decoded events to create a map of adjustments which would be made to balances
    let balanceAdjustmentRsp = await oThis._computeBalanceAdjustments(txHashDecodedEventsMap);
    if (balanceAdjustmentRsp.isFailure()) {
      console.error('balanceAdjustmentRsp', JSON.strinfigy(balanceAdjustmentRsp.toHash()));
      return Promise.reject(balanceAdjustmentRsp);
    }

    let balanceAdjustmentMap = balanceAdjustmentRsp.data['balanceAdjustmentMap']
      , txHashTransferEventsMap = balanceAdjustmentRsp.data['txHashTransferEventsMap']
      , affectedAddresses = balanceAdjustmentRsp.data['affectedAddresses']
    ;

    // console.log('balanceAdjustmentMap', balanceAdjustmentMap);
    // console.log('txHashTransferEventsMap', txHashTransferEventsMap);

    // fetch recognized transactions map
    let fetchRecognizedTransactionRsp = await oThis._fetchRecognizedTransactionDetails(batchBlockTxHashes);
    if (fetchRecognizedTransactionRsp.isFailure()) {
      console.error('fetchRecognizedTransactionRsp', JSON.strinfigy(fetchRecognizedTransactionRsp.toHash()));
      return Promise.reject(fetchRecognizedTransactionRsp);
    }
    let recognizedTxHashDataMap = fetchRecognizedTransactionRsp.data['recognizedTxHashDataMap'];

    // console.log('recognizedTxHashDataMap', recognizedTxHashDataMap);

    // format data to be inserted into transaction logs
    let params = {
      blockNoDetailsMap: blockNoDetailsMap,
      txHashToTxReceiptMap: txHashToTxReceiptMap,
      erc20ContractAddressesData: erc20ContractAddressesData,
      txHashTransferEventsMap: txHashTransferEventsMap,
      recognizedTxHashDataMap: recognizedTxHashDataMap,
      affectedAddresses: affectedAddresses
    };
    let formatDataRsp = await oThis._fetchFormattedTransactionsForMigration(params);
    if (formatDataRsp.isFailure()) {
      console.error('formatDataRsp', JSON.strinfigy(formatDataRsp.toHash()));
      return Promise.reject(formatDataRsp);
    }
    let formattedTransactionsData = formatDataRsp.data['formattedTransactionsData'];

    // console.log('formattedTransactionsData', formattedTransactionsData);

    let insertTxLogsRsp = await oThis._insertDataInTransactionLogs(formattedTransactionsData);
    if (insertTxLogsRsp.isFailure()) {
      console.error('insertTxLogsRspError', JSON.strinfigy(insertTxLogsRsp.toHash()));
      return Promise.reject(insertTxLogsRsp);
    }
    let failedInsertResponses = insertTxLogsRsp.data['failedInsertResponses'];
    console.log('failedInsertResponses', JSON.stringify(failedInsertResponses));

    let settleBalancesRsp = await oThis._settleBalancesInDb(balanceAdjustmentMap);
    if (settleBalancesRsp.isFailure()) {
      console.error('settleBalancesRspError', JSON.strinfigy(settleBalancesRsp.toHash()));
      return Promise.reject(settleBalancesRsp);
    }
    let settleResponses = settleBalancesRsp.data['settleResponses'];
    // console.log('settleResponses', JSON.stringify(settleResponses));

  },

  /**
   * fetch transaction hashes for block
   *
   * @returns {promise<result>}
   */
  _fetchBlockDetails: async function (blockNumbers) {
    const oThis = this;

    let promiseArray = []
      , blockNoDetailsMap = {}
      , txHashes = []
    ;

    logger.info(`starting to fetch data for blocknumbers ${JSON.stringify(blockNumbers)}`);

    for (let index = 0; index < blockNumbers.length; index++) {
      promiseArray.push(oThis.web3Provider.eth.getBlock(blockNumbers[index]));
    }

    let promiseResponses = await Promise.all(promiseArray);

    logger.info(`fetched txHashes for blocknumbers ${JSON.stringify(blockNumbers)}`);

    for (let index = 0; index < blockNumbers.length; index++) {
      let blockDetail = promiseResponses[index];
      blockNoDetailsMap[blockNumbers[index]] = {
        txHashes: blockDetail['transactions'],
        timestamp: blockDetail['timestamp'] * 1000 // to convert to millisecond
      };

      for (let j = 0; j < blockDetail['transactions'].length; j++) {
        txHashes.push(blockDetail['transactions'][j]);
      }
    }

    return Promise.resolve(responseHelper.successWithData({
      blockNoDetailsMap: blockNoDetailsMap,
      txHashes: txHashes
    }));

  },

  /**
   * fetch transaction receipts
   *
   * @returns {promise<result>}
   */
  _fetchTransactionReceipts: async function (txHashes) {
    const oThis = this
    ;

    let txHashToTxReceiptMap = {}
      , parallelTxCountToFetch = 25
      , batchNo = 1
    ;

    while (true) {
      let offset = (batchNo - 1) * parallelTxCountToFetch
        , batchedTxHashes = txHashes.slice(offset, parallelTxCountToFetch + offset)
      ;

      if (batchedTxHashes.length === 0) break;

      logger.info(`starting to fetch receipts for batch: ${batchNo} with txHashes ${JSON.stringify(batchedTxHashes)}`);

      let promiseArray = [];

      for (var i = 0; i < batchedTxHashes.length; i++) {
        promiseArray.push(oThis.web3Provider.eth.getTransactionReceipt(batchedTxHashes[i]));
      }

      let promiseResponses = await Promise.all(promiseArray);

      logger.info(`fetched receipts for batch: ${batchNo}`);

      for (var i = 0; i < batchedTxHashes.length; i++) {
        txHashToTxReceiptMap[batchedTxHashes[i]] = promiseResponses[i];
      }

      batchNo = batchNo + 1;
    }

    return Promise.resolve(responseHelper.successWithData({txHashToTxReceiptMap: txHashToTxReceiptMap}));
  },

  /**
   * shortlist tranasction events and returns map (key as txHash and value as array of shortlisted events)
   *
   * @returns {promise<result>}
   */
  _shortListTransactionEvents: async function (txHashToTxReceiptMap) {
    const oThis = this
    ;

    logger.info('starting _shortListTransactionEvents');
    // collect contract addresses of all events
    let contractAddresses = []
      , erc20ContractAddressesData = {}
      , txHashToShortListedEventsMap = {}
      , txHashes = Object.keys(txHashToTxReceiptMap)
    ;

    for (let i = 0; i < txHashes.length; i++) {
      let txReceipt = txHashToTxReceiptMap[txHashes[i]];
      for (var j = 0; j < txReceipt.logs.length; j++) {
        let txReceiptLogElement = txReceipt.logs[j];
        contractAddresses.push(txReceiptLogElement.address);
      }
    }

    if (contractAddresses.length > 0) {
      // from these addresses create a map of addresses of which are ERC20 address
      let cacheObj = new Erc20ContractAddressCacheKlass({addresses: contractAddresses})
        , cacheFetchRsp = await cacheObj.fetch()
      ;
      if (cacheFetchRsp.isFailure()) {
        return Promise.reject(cacheFetchRsp)
      }
      erc20ContractAddressesData = cacheFetchRsp.data;
    }

    for (let i = 0; i < txHashes.length; i++) {
      let txHash = txHashes[i]
        , txReceipt = txHashToTxReceiptMap[txHash]
      ;

      for (let j = 0; j < txReceipt.logs.length; j++) {

        let txReceiptLogElement = txReceipt.logs[j]
          , contractAddress = txReceiptLogElement.address.toLowerCase()
          , eventSignature = txReceiptLogElement.topics[0]
        ;

        let isKnownBTContract = erc20ContractAddressesData[contractAddress];
        let isTransferEvent = eventSignature === oThis.TransferEventSignature;
        let isUtilityContract = oThis.OpenSTUtilityContractAddr === contractAddress;
        let isProcessedMintEvent = eventSignature === oThis.ProcessedMintEventSignature;
        let isRevertedMintEvent = eventSignature === oThis.RevertedMintEventSignature;

        if ((isKnownBTContract && isTransferEvent) ||
          (isUtilityContract && (isProcessedMintEvent || isRevertedMintEvent))) {

          txHashToShortListedEventsMap[txHash] = txHashToShortListedEventsMap[txHash] || [];
          txHashToShortListedEventsMap[txHash].push(txReceiptLogElement);
        }
      }
    }

    logger.info('completed _shortListTransactionEvents');

    return Promise.resolve(responseHelper.successWithData({
      txHashShortListedEventsMap: txHashToShortListedEventsMap,
      erc20ContractAddressesData: erc20ContractAddressesData
    }));
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

    return Promise.resolve(responseHelper.successWithData({txHashDecodedEventsMap: txHashDecodedEventsMap}));
  },

  /**
   * computes balance adjustment map. returns map with key as contract address and value as a map
   * which has key as user_eth_address and value as amount to be adjusted
   *
   * @returns {promise<result>}
   */
  _computeBalanceAdjustments: async function (txHashDecodedEventsMap) {
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
          , contractUuid = null
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
            case "_amount":
              valueStr = eventData.value;
              break;
            case "_uuid":
              contractUuid = eventData.value.toLowerCase();
              break;
          }
        }

        if (contractUuid) {
          // it is not an transfer event but is a mint event
          if (contractUuid === oThis.StPrimeContractUuid) {
            // for St prime uuid do not settle balances
            continue;
          } else {
            let cacheObj = new Erc20ContractUuidCacheKlass({uuids: [contractUuid]})
              , cacheFetchRsp = await cacheObj.fetch()
            ;
            if (cacheFetchRsp.isFailure()) {
              return Promise.reject(cacheFetchRsp)
            }
            let erc20ContractUuidsData = cacheFetchRsp.data;
            // overridr contractAddress of ostutility contract with that of erc 20 address of this token
            contractAddress = erc20ContractUuidsData[contractUuid]['token_erc20_address'].toLowerCase();
            switch (decodedEventData.name) {
              case "ProcessedMint":
                toAddr = contractAddress;
                break;
              case "RevertedMint":
                fromAddr = contractAddress;
                break;
              default:
                return Promise.reject(responseHelper.error({
                  internal_error_identifier: 'e_drdm_ads_2',
                  api_error_identifier: 'unhandled_catch_response',
                  debug_options: {}
                }));
                break;
            }
          }
        }

        balanceAdjustmentMap[contractAddress] = balanceAdjustmentMap[contractAddress] || {};
        let valueBn = new BigNumber(valueStr);

        if (fromAddr) {
          balanceAdjustmentMap[contractAddress][fromAddr] = balanceAdjustmentMap[contractAddress][fromAddr] || new BigNumber('0');
          balanceAdjustmentMap[contractAddress][fromAddr] = balanceAdjustmentMap[contractAddress][fromAddr].minus(valueBn);
          affectedAddresses.push(fromAddr);
        }

        if (toAddr) {
          balanceAdjustmentMap[contractAddress][toAddr] = balanceAdjustmentMap[contractAddress][toAddr] || new BigNumber('0');
          balanceAdjustmentMap[contractAddress][toAddr] = balanceAdjustmentMap[contractAddress][toAddr].plus(valueBn);
          affectedAddresses.push(toAddr);
        }

        // for mit events we would mark staker addr as from / to and wouldn't settle this entry in DB (as out of thin air)
        transferEvents.push({
          from_address: fromAddr || oThis.ZeroXAddress,
          to_address: toAddr || oThis.ZeroXAddress,
          amount_in_wei: valueStr
        });

      }

      txHashTransferEventsMap[txHash] = transferEvents;

      // uniq!
      affectedAddresses = affectedAddresses.filter(function (item, pos) {
        return affectedAddresses.indexOf(item) == pos;
      });

    }

    logger.info('completed _computeBalanceAdjustments');

    return Promise.resolve(responseHelper.successWithData({
      balanceAdjustmentMap: balanceAdjustmentMap,
      txHashTransferEventsMap: txHashTransferEventsMap,
      affectedAddresses: affectedAddresses
    }));

  },

  /**
   * fetch recognized transactions map (txHash as key and id as value)
   *
   * @returns {promise<result>}
   */
  _fetchRecognizedTransactionDetails: async function (txHashes) {

    const oThis = this;

    logger.info('starting _fetchRecognizedTransactionDetails');

    let txHashDataMap = {}
      , recognizedTxLogRecords = []
    ;

    if (txHashes.length > 0) {
      recognizedTxLogRecords = await new TransactionLogModel().getAllColumnsByTransactionHash(txHashes);
    }

    for (var i = 0; i < recognizedTxLogRecords.length; i++) {
      txHashDataMap[recognizedTxLogRecords[i]['transaction_hash']] = recognizedTxLogRecords[i];
    }

    logger.info('completed _fetchRecognizedTransactionDetails');

    return Promise.resolve(responseHelper.successWithData({recognizedTxHashDataMap: txHashDataMap}));

  },

  /**
   * from all the data we have fetched till now, format it to a format which could be directly inserted in DDB.
   *
   * @returns {promise<result>}
   */
  _fetchFormattedTransactionsForMigration: async function (params) {

    logger.info('starting _fetchFormattedTransactionsForMigration');

    let blockNoDetailsMap = params['blockNoDetailsMap']
      , blockNos = Object.keys(blockNoDetailsMap)
      , txHashToTxReceiptMap = params['txHashToTxReceiptMap']
      , erc20ContractAddressesData = params['erc20ContractAddressesData']
      , txHashTransferEventsMap = params['txHashTransferEventsMap']
      , recognizedTxHashDataMap = params['recognizedTxHashDataMap']
      , affectedAddresses = params['affectedAddresses']
      , addressUuidMap = {}
      , formattedTransactionsData = {}
      , completeStatus = parseInt(new TransactionLogModel().invertedStatuses[TransactionLogConst.completeStatus])
      , failedStatus = parseInt(new TransactionLogModel().invertedStatuses[TransactionLogConst.failedStatus])
      ,
      tokenTransferType = parseInt(new TransactionLogModel().invertedTransactionTypes[TransactionLogConst.extenralTokenTransferTransactionType])
      ,
      stpTransferTransactionType = parseInt(new TransactionLogModel().invertedTransactionTypes[TransactionLogConst.stpTransferTransactionType])
    ;

    if (affectedAddresses.length > 0) {
      let dbRows = await new ManagedAddressModel().getByEthAddresses(affectedAddresses);
      for (let i = 0; i < dbRows.length; i++) {
        let dbRow = dbRows[i];
        addressUuidMap[dbRow['ethereum_address'].toLowerCase()] = dbRow['uuid'];
      }
    }

    for (let k = 0; k < blockNos.length; k++) {

      let blockNo = blockNos[k];

      let txHashes = blockNoDetailsMap[blockNo]['txHashes'];

      for (let i = 0; i < txHashes.length; i++) {

        let txHash = txHashes[i]
          , existingTxData = recognizedTxHashDataMap[txHash]
          , txFormattedData = {}
          , txDataFromChain = txHashToTxReceiptMap[txHash]
        ;

        // If this was a recorded transaction already
        if (existingTxData) {

          if (parseInt(existingTxData['transaction_type']) === stpTransferTransactionType) {
            continue;
            // ignore stpTransferTransactionType
          }

          if (!txHashTransferEventsMap[txHash]) {
            if (parseInt(txDataFromChain.status, 16) == 1) {
              console.log('highAlert: knownInternalTxsDontHaveEvents', txHash);
            }
          }

          let existingInputParams = existingTxData['input_params']
            , existingFormattedReceipt = existingTxData['formatted_receipt']
          ;

          txFormattedData = {
            transaction_hash: txHash,
            transaction_uuid: existingTxData['transaction_uuid'],
            transaction_type: existingTxData['transaction_type'],
            block_number: existingTxData['block_number'] || txDataFromChain['blockNumber'],
            client_id: parseInt(existingTxData['client_id']),
            client_token_id: existingTxData['client_token_id'],
            gas_used: existingTxData['gas_used'] || txDataFromChain['gasUsed'],
            gas_price: existingTxData['gas_price'],
            status: existingTxData['status'],
            created_at: new Date(existingTxData['created_at']).getTime(),
            updated_at: new Date(existingTxData['updated_at']).getTime()
          };

          if (!commonValidator.isVarNull(existingInputParams['amount_in_wei'])) {
            txFormattedData['amount_in_wei'] = existingInputParams['amount_in_wei']
          }
          if (!commonValidator.isVarNull(existingFormattedReceipt['bt_transfer_in_wei'])) {
            txFormattedData['amount_in_wei'] = existingFormattedReceipt['bt_transfer_in_wei']
          }
          if (!commonValidator.isVarNull(existingInputParams['to_address'])) {
            txFormattedData['to_address'] = existingInputParams['to_address']
          }
          if (!commonValidator.isVarNull(existingInputParams['from_address'])) {
            txFormattedData['from_address'] = existingInputParams['from_address']
          }
          if (!commonValidator.isVarNull(existingInputParams['from_uuid'])) {
            txFormattedData['from_uuid'] = existingInputParams['from_uuid']
          }
          if (!commonValidator.isVarNull(existingInputParams['to_uuid'])) {
            txFormattedData['to_uuid'] = existingInputParams['to_uuid']
          }
          if (!commonValidator.isVarNull(existingInputParams['token_symbol'])) {
            txFormattedData['token_symbol'] = existingInputParams['token_symbol']
          }
          if (!commonValidator.isVarNull(existingInputParams['transaction_kind_id'])) {
            txFormattedData['action_id'] = existingInputParams['transaction_kind_id']
          }
          if (!commonValidator.isVarNull(existingFormattedReceipt['error_code'])) {
            txFormattedData['error_code'] = existingFormattedReceipt['error_code']
          }
          if (!commonValidator.isVarNull(existingFormattedReceipt['commission_amount_in_wei'])) {
            txFormattedData['commission_amount_in_wei'] = existingFormattedReceipt['commission_amount_in_wei']
          }

        } else {

          // ignore this transaction if this had no recognized event
          if (!txHashTransferEventsMap[txHash]) {
            continue
          }

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
            created_at: blockNoDetailsMap[blockNo]['timestamp'],
            updated_at: blockNoDetailsMap[blockNo]['timestamp'],
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

    }

    logger.info('completed _fetchFormattedTransactionsForMigration');

    return Promise.resolve(responseHelper.successWithData({formattedTransactionsData: formattedTransactionsData}));
  },

  /**
   * bulk create records in DDB
   *
   * @returns {promise<result>}
   */
  _insertDataInTransactionLogs: async function (formattedTransactionsData) {
    const oThis = this;

    logger.info('starting _insertDataInTransactionLogs');

    let failedInsertResponses = {}
      , clientIds = Object.keys(formattedTransactionsData)
    ;

    for (let k = 0; k < clientIds.length; k++) {

      let clientId = clientIds[k]
        , dataToInsert = formattedTransactionsData[clientId]
      ;

      logger.info(`starting _insertDataInTransactionLogs clientId : ${clientId} length : ${dataToInsert.length}`);

      let rsp = await new TransactionLogModelDdb({
        client_id: clientId,
        ddb_service: ddbServiceObj,
        auto_scaling: autoscalingServiceObj
      }).batchPutItem(dataToInsert);

      failedInsertResponses[clientId] = rsp.toHash();

    }

    logger.info('completed _insertDataInTransactionLogs');

    return Promise.resolve(responseHelper.successWithData({failedInsertResponses: failedInsertResponses}));

  },

  /**
   * settle balances in DB
   *
   * @returns {promise<result>}
   */
  _settleBalancesInDb: async function (balanceAdjustmentMap) {

    const oThis = this;

    logger.info('starting _settleBalancesInDb');

    let settleResponses = {}
      , erc20ContractAddresses = Object.keys(balanceAdjustmentMap)
    ;

    for (let k = 0; k < erc20ContractAddresses.length; k++) {

      let erc20ContractAddress = erc20ContractAddresses[k];

      let userBalancesSettlementsData = balanceAdjustmentMap[erc20ContractAddress]
        , tokenalanceModelObj = new TokenBalanceModelDdb({
          erc20_contract_address: erc20ContractAddress,
          chain_id: chainInteractionConstants.UTILITY_CHAIN_ID,
          ddb_service: ddbServiceObj,
          auto_scaling: autoscalingServiceObj
        })
        , promises = []
        , userAddresses = Object.keys(userBalancesSettlementsData)
      ;

      for (var l = 0; l < userAddresses.length; l++) {

        let userAddress = userAddresses[l];

        promises.push(tokenalanceModelObj.update({
          settle_amount: userBalancesSettlementsData[userAddress].toString(10),
          ethereum_address: userAddress
        }));

      }

      let promiseResponses = await Promise.all(promises)
        , formattedPromiseResponses = []
      ;

      for (var l = 0; l < promiseResponses.length; l++) {
        formattedPromiseResponses.push(promiseResponses[l].toHash());
      }

      settleResponses[erc20ContractAddress] = formattedPromiseResponses;

    }

    logger.info('completed _settleBalancesInDb');

    return Promise.resolve(responseHelper.successWithData({settleResponses: settleResponses}));

  }

}

const usageDemo = function () {
  logger.log('usage:', 'node ./executables/ddb_related_data_migrations/migrate_data_from_chain_to_ddb.js startBlockNo endBlockNo');
};

const args = process.argv
  , startBlockNo = parseInt(args[2])
  , endBlockNo = parseInt(args[3])
;

const validateAndSanitize = function () {
  if (!commonValidator.isVarInteger(startBlockNo)) {
    logger.error('startBlockNo is NOT valid in the arguments. It should be an integer. We will process this block too.');
    usageDemo();
    process.exit(1);
  }

  if (!commonValidator.isVarInteger(endBlockNo)) {
    logger.error('endBlockNo is NOT valid in the arguments. It should be an integer. We will process this block too.');
    usageDemo();
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

const obj = new MigrateTokenBalancesKlass({start_block_no: startBlockNo, end_block_no: endBlockNo});
obj.perform();