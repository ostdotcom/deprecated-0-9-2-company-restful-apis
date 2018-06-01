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
    , bigNumber = require('bignumber.js')
    , uuid = require('uuid')
;

const coreAbis = openStPlatform.abis
;

abiDecoder.addABI(coreAbis.brandedToken);

const rootPrefix = '../..'
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , commonValidator = require(rootPrefix +  '/lib/validators/common')
    , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
    , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
    , TransactionLogModelDdb = openStorage.TransactionLogModel
    , TransactionLogConst = openStorage.TransactionLogConst
    , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
    , Erc20ContractAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/erc20_contract_address')
;

const MigrateTokenBalancesKlass = function (params) {

  const oThis = this
  ;

  oThis.startBlockNo = params.start_block_no;
  oThis.endBlockNo = params.end_block_no;

  oThis.web3Provider = new Web3(chainInteractionConstants.UTILITY_GETH_WS_PROVIDER);

  // TODO: Check if this signature is same across chain ids
  oThis.transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  oThis.parallelBlocksToProcessCnt = 10;
  oThis.blockNoArray = [];

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

    var batchNo = 1;

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

    const oThis = this;

    for(let blockNo=oThis.startBlockNo; blockNo<=oThis.endBlockNo; blockNo++) {
      oThis.blockNoArray.push(blockNo);
    }

    return Promise.resolve({});

  },

  /**
   * process blocks
   *
   * @returns {promise<result>}
   */
  _processBlocks: async function (blockNumbers) {

    const oThis = this;

    // fetch transaction hashes
    let fetchBlockDetailsRsp = await oThis._fetchBlockDetails(blockNumbers);
    if(fetchBlockDetailsRsp.isFailure()) {return Promise.reject(fetchBlockDetailsRsp)}
    let txHashes = fetchBlockDetailsRsp.data['txHashes']
        , blockNoDetailsMap = fetchBlockDetailsRsp.data['blockNoDetailsMap']
    ;

    console.log('txHashes', txHashes);
    console.log('blockNoDetailsMap', blockNoDetailsMap);

    // fetch transaction receipts
    let fetchTransactionReceiptRsp = await oThis._fetchTransactionReceipts(txHashes);
    if(fetchTransactionReceiptRsp.isFailure()) {return Promise.reject(fetchTransactionReceiptRsp)}
    let txHashToTxReceiptMap = fetchTransactionReceiptRsp.data['txHashToTxReceiptMap'];

    console.log('txHashToTxReceiptMap', txHashToTxReceiptMap);

    // fetch transactions to shortlisted events map
    let shortListTransactionEventRsp = await oThis._shortListTransactionEvents(txHashToTxReceiptMap);
    if(shortListTransactionEventRsp.isFailure()) {return Promise.reject(shortListTransactionEventRsp)}
    let txHashShortListedEventsMap = shortListTransactionEventRsp.data['txHashShortListedEventsMap']
        , erc20ContractAddressesData = shortListTransactionEventRsp.data['erc20ContractAddressesData']
    ;

    console.log('txHashShortListedEventsMap', txHashShortListedEventsMap);
    console.log('erc20ContractAddressesData', erc20ContractAddressesData);

    // decode shortlisted events
    let decodeEventRsp = await oThis._decodeTransactionEvents(txHashShortListedEventsMap);
    if(decodeEventRsp.isFailure()) {return Promise.reject(decodeEventRsp)}
    let txHashDecodedEventsMap = decodeEventRsp.data['txHashDecodedEventsMap'];

    console.log('txHashDecodedEventsMap', txHashDecodedEventsMap);

    // iterate over decoded events to create a map of adjustments which would be made to balances
    let balanceAdjustmentRsp = await oThis._computeBalanceAdjustments(txHashDecodedEventsMap);
    if(balanceAdjustmentRsp.isFailure()) {return Promise.reject(balanceAdjustmentRsp)}
    let balanceAdjustmentMap = balanceAdjustmentRsp.data['balanceAdjustmentMap']
        , txHashTransferEventsMap = balanceAdjustmentRsp.data['txHashTransferEventsMap']
        , affectedAddresses = balanceAdjustmentRsp.data['affectedAddresses']
    ;

    console.log('balanceAdjustmentMap', balanceAdjustmentMap);
    console.log('txHashTransferEventsMap', txHashTransferEventsMap);

    // fetch recognized transactions map
    let fetchRecognizedTransactionRsp = await oThis._fetchRecognizedTransactionDetails(txHashes);
    if(fetchRecognizedTransactionRsp.isFailure()) {return Promise.reject(fetchRecognizedTransactionRsp)}
    let recognizedTxHashDataMap = fetchRecognizedTransactionRsp.data['recognizedTxHashDataMap'];

    console.log('recognizedTxHashDataMap', recognizedTxHashDataMap);

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
    if(formatDataRsp.isFailure()) {return Promise.reject(formatDataRsp)}
    let formattedTransactionsData = formatDataRsp.data['formattedTransactionsData'];

    console.log('formattedTransactionsData', formattedTransactionsData);

  },

  /**
   * fetch transaction hashes for block
   *
   * @returns {promise<result>}
   */
  _fetchBlockDetails: async function (blockNumbers) {

    const oThis = this;

    let promises = []
        , blockNoDetailsMap = {}
        , txHashes = []
    ;

    logger.info(`starting to fetch txHashes for blocknumbers ${JSON.stringify(blockNumbers)}`);

    for(let index=0; index<blockNumbers.length; index++) {
      let promise = await oThis.web3Provider.eth.getBlock(blockNumbers[index]);
      promises.push(promise);
    }

    const promiseResponses = await Promise.all(promises);

    logger.info(`fetched txHashes for blocknumbers ${JSON.stringify(blockNumbers)}`);

    for(let index=0; index<blockNumbers.length; index++) {
      let blockDetail = promiseResponses[index];
      blockNoDetailsMap[blockNumbers[index]] = {
        txHashes: blockDetail['transactions'],
        timestamp: blockDetail['timestamp'] * 1000
      };
      for(let j=0; j<blockDetail['transactions'].length; j++) {
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

    const oThis = this;

    let txHashToTxReceiptMap = {}
        , parallelTxCountToFetch = 25
    ;

    var batchNo = 1;

    while (true) {

      let offset = (batchNo - 1) * parallelTxCountToFetch
          , batchedTxHashes = txHashes.slice(offset, parallelTxCountToFetch + offset)
      ;

      if (batchedTxHashes.length === 0) break;

      logger.info(`starting to fetch receipts for batch: ${batchNo} with txHashes ${JSON.stringify(batchedTxHashes)}`);

      let promises = [];

      for(var i=0; i<batchedTxHashes.length; i++) {
        promises.push(oThis.web3Provider.eth.getTransactionReceipt(batchedTxHashes[i]));
      }

      let promiseResponses = await Promise.all(promises);
      logger.info(`fetched receipts for batch: ${batchNo}`);

      for(var i=0; i<batchedTxHashes.length; i++) {
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

    const oThis = this;

    // collect contract addresses of all events
    let contractAddresses = []
        , erc20ContractAddressesData = {}
        , txHashToShortListedEventsMap = {}
    ;

    Object.keys(txHashToTxReceiptMap).forEach(function (txHash) {
      let txReceipt = txHashToTxReceiptMap[txHash];
      for(var i=0; i<txReceipt.logs.length; i++) {
        let txReceiptLog = txReceipt.logs[i];
        contractAddresses.push(txReceiptLog.address);
      }
    })

    if (contractAddresses.length > 0) {
      // from these addresses create a map of addresses of which are ERC20 address
      let cacheObj = new Erc20ContractAddressCacheKlass({addresses: contractAddresses})
          , cacheFetchRsp = await cacheObj.fetch()
      ;
      if(cacheFetchRsp.isFailure()) {return Promise.reject(cacheFetchRsp)}
      erc20ContractAddressesData = cacheFetchRsp.data;
    }

    Object.keys(txHashToTxReceiptMap).forEach(function (txHash) {
      let txReceipt = txHashToTxReceiptMap[txHash];
      for(var i=0; i<txReceipt.logs.length; i++) {
        let txReceiptLog = txReceipt.logs[i];
        if(erc20ContractAddressesData.hasOwnProperty(txReceiptLog.address.toLowerCase()) &&
            txReceiptLog.topics[0] === oThis.transferEventSignature) {
          if(!txHashToShortListedEventsMap.hasOwnProperty(txHash)) {
            txHashToShortListedEventsMap[txHash] = [];
          }
          txHashToShortListedEventsMap[txHash].push(txReceiptLog);
        }
      }
    })

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

    const oThis = this;

    // Decode events from AbiDecoder
    let txHashDecodedEventsMap = {};
    Object.keys(txHashEventsMap).forEach(function (txHash) {
      //TODO: Handle exceptions here and log those transactions in DB
      txHashDecodedEventsMap[txHash] = abiDecoder.decodeLogs(txHashEventsMap[txHash]);
    })

    return Promise.resolve(responseHelper.successWithData({txHashDecodedEventsMap: txHashDecodedEventsMap}));

  },

  /**
   * computes balance adjustment map. returns map with key as contract address and value as a map
   * which has key as user_eth_address and value as amount to be adjusted
   *
   * @returns {promise<result>}
   */
  _computeBalanceAdjustments: async function (txHashDecodedEventsMap) {

    const oThis = this;

    let balanceAdjustmentMap = {}
        , txHashTransferEventsMap = {}
        , affectedAddresses = []
    ;

    Object.keys(txHashDecodedEventsMap).forEach(function (txHash) {

      let decodedEventsMap = txHashDecodedEventsMap[txHash]
          , transferEvents = []
      ;

      for(var i=0; i<decodedEventsMap.length; i++) {

        let decodedEventData = decodedEventsMap[i];

        if (!balanceAdjustmentMap.hasOwnProperty(decodedEventData.address)) {
          balanceAdjustmentMap[decodedEventData.address] = {};
        }

        let fromAddr = null
            , toAddr = null
            , value = null
        ;

        for(var j=0; j<decodedEventData.events.length; j++) {
          let eventData = decodedEventData.events[j];
          switch(eventData.name) {
            case "_from":
              fromAddr = eventData.value;
              break;
            case "_to":
              toAddr = eventData.value;
              break;
            case "_value":
              value = eventData.value;
              break;
          }
        }

        if (!balanceAdjustmentMap[decodedEventData.address].hasOwnProperty(fromAddr)) {
          balanceAdjustmentMap[decodedEventData.address][fromAddr] = new bigNumber('0');
        }

        if (!balanceAdjustmentMap[decodedEventData.address].hasOwnProperty(toAddr)) {
          balanceAdjustmentMap[decodedEventData.address][toAddr] = new bigNumber('0');
        }

        let valueBn = new bigNumber(value);
        balanceAdjustmentMap[decodedEventData.address][fromAddr] = balanceAdjustmentMap[decodedEventData.address][fromAddr].minus(valueBn);
        balanceAdjustmentMap[decodedEventData.address][toAddr] = balanceAdjustmentMap[decodedEventData.address][toAddr].plus(valueBn);

        transferEvents.push({
          from_address: fromAddr,
          to_address: toAddr,
          value: value
        });

        affectedAddresses.push(fromAddr);
        affectedAddresses.push(toAddr);

      }

      txHashTransferEventsMap[txHash] = transferEvents;

      // uniq!
      affectedAddresses = affectedAddresses.filter(function(item, pos){
        return affectedAddresses.indexOf(item)== pos;
      });

    })

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

    let txHashDataMap = {}
        , recognizedTxLogRecords = []
    ;

    if (txHashes.length > 0) {
      recognizedTxLogRecords = await new TransactionLogModel().getAllColumnsByTransactionHash(txHashes);
    }

    for(var i=0; i<recognizedTxLogRecords.length; i++) {
      txHashDataMap[recognizedTxLogRecords[i]['transaction_hash']] = recognizedTxLogRecords[i];
    }

    return Promise.resolve(responseHelper.successWithData({recognizedTxHashDataMap: txHashDataMap}));

  },

  /**
   * from all the data we have fetched till now, format it to a format which could be directly inserted in DDB.
   *
   * @returns {promise<result>}
   */
  _fetchFormattedTransactionsForMigration: async function (params) {

    let blockNoDetailsMap = params['blockNoDetailsMap']
        , txHashToTxReceiptMap = params['txHashToTxReceiptMap']
        , erc20ContractAddressesData = params['erc20ContractAddressesData']
        , txHashTransferEventsMap = params['txHashTransferEventsMap']
        , recognizedTxHashDataMap = params['recognizedTxHashDataMap']
        , affectedAddresses = params['affectedAddresses']
        , addressUuidMap = {}
        , formattedTransactionsData = []
        , completeStatus = parseInt(new TransactionLogModel().invertedStatuses[TransactionLogConst.completeStatus])
        , failedStatus = parseInt(new TransactionLogModel().invertedStatuses[TransactionLogConst.failedStatus])
        , tokenTransferType = parseInt(new TransactionLogModel().invertedTransactionTypes[TransactionLogConst.extenralTokenTransferTransactionType])
    ;

    if (affectedAddresses.length > 0) {
      let dbRows = await new ManagedAddressModel().getByEthAddresses(affectedAddresses);
      for(var i=0; i<dbRows.length; i++) {
        let dbRow = dbRows[i];
        addressUuidMap[dbRow['ethereum_address'].toLowerCase()] = dbRow['uuid'];
      }
    }

    Object.keys(blockNoDetailsMap).forEach(function (blockNo) {

      let txHashes = blockNoDetailsMap[blockNo]['txHashes'];

      for(var i=0; i<txHashes.length; i++) {

        let txHash = txHashes[i]
            , existingTxData = recognizedTxHashDataMap[txHash]
            , txFormattedData = {}
            , txDataFromChain = txHashToTxReceiptMap[txHash]
        ;

        // If this was a recorded transaction already
        if (existingTxData) {

          if (!txHashTransferEventsMap[txHash] && existingTxData['status'] != 3) {
            console.log('highAlert', txHash);
            continue;
          }

          let  existingInputParams = existingTxData['input_params']
              , existingFormattedReceipt = existingTxData['formatted_receipt']
          ;

          txFormattedData = {
            transaction_hash: txHash,
            transaction_uuid: existingTxData['transaction_uuid'],
            transaction_type: existingTxData['transaction_type'],
            block_number: existingTxData['block_number'],
            client_id: existingTxData['client_id'],
            client_token_id: existingTxData['client_token_id'],
            token_symbol: existingInputParams['token_symbol'],
            gas_used: existingTxData['gas_used'],
            gas_price: existingTxData['gas_price'],
            status: existingTxData['status'],
            created_at: new Date(existingTxData['created_at']).getTime(),
            from_uuid: existingInputParams['from_uuid'],
            to_uuid: existingInputParams['to_uuid'],
            action_id: existingInputParams['transaction_kind_id'],
            commission_amount_in_wei: existingFormattedReceipt['commission_amount_in_wei'],
            bt_transfer_in_wei: existingFormattedReceipt['bt_transfer_in_wei']
          };

          if (existingInputParams['commission_percent']) {txFormattedData['commission_percent'] = existingInputParams['commission_percent']}
          if (existingInputParams['amount']) {txFormattedData['amount'] = existingInputParams['amount']}
          if (existingInputParams['amount_in_wei']) {txFormattedData['amount_in_wei'] = existingInputParams['amount_in_wei']}
          if (existingInputParams['to_address']) {txFormattedData['to_address'] = existingInputParams['to_address']}
          if (existingInputParams['from_address']) {txFormattedData['from_address'] = existingInputParams['from_address']}
          if (existingFormattedReceipt['error_code']) {txFormattedData['error_code'] = existingFormattedReceipt['error_code']}

        } else {

          // ignore this transaction if this had no recognized event
          if (!txHashTransferEventsMap[txHash]) {continue}

          let contractAddress = txDataFromChain.logs[0].address
              , erc20ContractAddressData = erc20ContractAddressesData[contractAddress.toLowerCase()]
          ;

          txFormattedData = {
            transaction_hash: txHash,
            transaction_uuid: uuid.v4(),
            transaction_type: tokenTransferType,
            block_number: txDataFromChain['blockNumber'],
            client_id: erc20ContractAddressData['client_id'],
            client_token_id: parseInt(erc20ContractAddressData['client_token_id']),
            token_symbol: erc20ContractAddressData['symbol'],
            gas_used: txDataFromChain['gasUsed'],
            status: (parseInt(txDataFromChain.status, 16) == 1) ? completeStatus : failedStatus,
            created_at: blockNoDetailsMap[blockNo]['timestamp'],
            from_address: txDataFromChain['from'],
            to_address: txDataFromChain['to'], //TODO: is it right to be using these from and to (to is mostly contract adddr) ?
            bt_transfer_in_wei: '' // Cant fetch it ?
          }

          let fromUuid = addressUuidMap[txDataFromChain['from'].toLowerCase()];
          if (fromUuid) {txFormattedData['from_uuid'] = fromUuid}

          let toUuid = addressUuidMap[txDataFromChain['to'].toLowerCase()];
          if (toUuid) {txFormattedData['to_uuid'] = toUuid}

        }

        if (txHashTransferEventsMap[txHash]) {
          txFormattedData['transfer_events'] = txHashTransferEventsMap[txHash];
          for(var j=0; j<txFormattedData['transfer_events'].length; j++) {
            let event_data = txFormattedData['transfer_events'][j];
            let fromUuid = addressUuidMap[event_data['from_address'].toLowerCase()];
            if (fromUuid) {event_data['from_uuid'] = fromUuid};
            let toUuid = addressUuidMap[event_data['to_address'].toLowerCase()];
            if (toUuid) {event_data['to_uuid'] = toUuid};
          }
        }

        formattedTransactionsData.push(txFormattedData);

      }

    });

    return Promise.resolve(responseHelper.successWithData({formattedTransactionsData: formattedTransactionsData}));

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
    logger.error('startBlockNo is NOT valid in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!commonValidator.isVarInteger(endBlockNo)) {
    logger.error('endBlockNo is NOT valid in the arguments.');
    usageDemo();
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

const obj = new MigrateTokenBalancesKlass({start_block_no: startBlockNo, end_block_no: endBlockNo});
obj.perform();