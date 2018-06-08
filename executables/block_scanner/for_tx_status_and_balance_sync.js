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
;

const rootPrefix = '../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , TransactionMeta = require(rootPrefix + '/app/models/transaction_meta')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , autoscalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
  , PostAirdropPayKlass = openStPayments.services.airdropManager.postAirdropPay
;

const TransactionLogModel = openStorage.TransactionLogModel
  , coreAbis = openStPlatform.abis
;

abiDecoder.addABI(coreAbis.airdrop);
abiDecoder.addABI(coreAbis.brandedToken);

const BlockScannerForTxStatusAndBalanceSync = function (params) {
  const oThis = this
  ;

  oThis.filePath = params.file_path;
  oThis.currentBlock = 0;
  oThis.scannerData = {};
  oThis.interruptSignalObtained = false;
  oThis.highestBlock = null;

  oThis.tokenTransferKind = new TransactionMeta().invertedKinds[transactionLogConst.tokenTransferTransactionType];
  oThis.stpTransferKind = new TransactionMeta().invertedKinds[transactionLogConst.stpTransferTransactionType];
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

        await oThis.generateToUpdateData();

        if (oThis.recognizedTxHashes.length === 0) {
          oThis.updateScannerDataFile();
          return oThis.schedule();
        }

        await oThis.processTokenTransferTransactions();

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
      ;

      batchNo = batchNo + 1;

      if (batchedTxHashes.length === 0) break;

      const batchedTxLogRecords = await new TransactionMeta()
        .getByTransactionHash(batchedTxHashes);

      if (batchedTxLogRecords.length === 0) continue;

      for (var i = 0; i < batchedTxLogRecords.length; i++) {

        const currRecord = batchedTxLogRecords[i];

        if (currRecord.kind == oThis.tokenTransferKind) {
          totalBtTransfers = totalBtTransfers + 1;
          oThis.tokenTransferTxHashesMap[currRecord.transaction_hash] = 1;
        } else if (currRecord.kind == oThis.stpTransferKind) {
          totalSTPTransfers = totalSTPTransfers + 1;
        } else {
          continue;
        }

        oThis.recognizedTxUuidsGroupedByClientId[currRecord.client_id] = oThis.recognizedTxUuidsGroupedByClientId[currRecord.client_id] || [];
        oThis.recognizedTxUuidsGroupedByClientId[currRecord.client_id].push(currRecord.transqaction_uuid);

        oThis.recognizedTxHashes.push(currRecord.transaction_hash);
        oThis.knownTxUuidToTxHashMap[currRecord.transaction_uuid] = currRecord.transaction_hash;
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
        , batchedTxHashes = oThis.recognizedTxHashes.slice(offset, batchSize + offset)
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
  generateToUpdateData: async function () {
    const oThis = this
      , batchSize = 50
    ;

    for (var clientId in oThis.recognizedTxUuidsGroupedByClientId) {
      let txUuids = oThis.recognizedTxUuidsGroupedByClientId[clientId];

      let batchNo = 1
      ;

      oThis.clientIdWiseDataToUpdate[clientId] = [];

      while (true) {
        const offset = (batchNo - 1) * batchSize
          , batchedTxUuids = txUuids.slice(offset, batchSize + offset)
          , batchedTxUuidToUpdateDataMap = {}
        ;

        batchNo = batchNo + 1;

        if (batchedTxUuids.length === 0) break;

        let batchGetItemResponse = await new TransactionLogModel({
          client_id: clientId,
          ddb_service: ddbServiceObj,
          auto_scaling: autoscalingServiceObj
        }).batchGetItem(batchedTxUuids);

        if (batchGetItemResponse.isFailure()) return Promise.reject(batchGetItemResponse);

        let batchGetItemData = batchGetItemResponse.data;

        for (var txUuid in batchGetItemData) {
          let txHash = oThis.knownTxUuidToTxHashMap[txUuid];
          let txReceipt = oThis.txHashToTxReceiptMap[txHash];

          let toUpdateFields = {};

          if (oThis.tokenTransferTxHashesMap[txHash]) {
            const decodedEvents = abiDecoder.decodeLogs(txReceipt.logs);

            if (batchGetItemData.post_receipt_process_params) {
              const postAirdropParams = batchGetItemData.post_receipt_process_params;
              const postAirdropPay = new PostAirdropPayKlass(postAirdropParams, decodedEvents, txReceipt.status);
              await postAirdropPay.perform();
            }

            const eventData = oThis._getEventData(decodedEvents);

            toUpdateFields = {
              commission_amount_in_wei: eventData._commissionTokenAmount,
              bt_transfer_in_wei: eventData._tokenAmount
            };
          }

          toUpdateFields.transaction_uuid = txUuid;
          toUpdateFields.transfer_events = eventData.transfer_events;
          toUpdateFields.post_receipt_process_params = null;
          toUpdateFields.gas_used = txReceipt.gasUsed;
          toUpdateFields.status = parseInt(txReceipt.status, 16);

          oThis.clientIdWiseDataToUpdate[clientId].push(toUpdateFields);
        }
      }
    }
  },

  /**
   * Update transaction logs table
   */
  updateTransactionLogs: async function () {
    const oThis = this
    ;

    for (var clientId in oThis.clientIdWiseDataToUpdate) {
      new TransactionLogModel({
        client_id: clientId,
        ddb_service: ddbServiceObj,
        auto_scaling: autoscalingServiceObj
      }).batchPutItem(oThis.clientIdWiseDataToUpdate[clientId]);
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

  _getEventData: function (decodedEvents) {
    const eventData = {_tokenAmount: '0', _commissionTokenAmount: '0', transfer_events: []};

    if (!decodedEvents || decodedEvents.length === 0) {
      return eventData;
    }

    let airdropPaymentEventVars = null
      , allTransferEventsVars = []
    ;

    for (var i = 0; i < decodedEvents.length; i++) {
      if (decodedEvents[i].name == 'AirdropPayment') {
        airdropPaymentEventVars = decodedEvents[i].events;
      }
      if (decodedEvents[i].name == 'Transfer') {
        allTransferEventsVars.push(decodedEvents[i].events);
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

    for (var i = 0; i < allTransferEventsVars.length; i++) {
      let transferEventVars = allTransferEventsVars[i];

      let transferEvent = {};

      for (var j = 0; j < transferEventVars.length; j ++) {
        if (transferEventVars[j].name == '_from') {
          transferEvent.from_address = transferEventVars[i].value;
        }

        if (transferEventVars[j].name == '_to') {
          transferEvent.to_address = transferEventVars[i].value;
        }

        if (transferEventVars[j].name == '_value') {
          transferEvent.amount_in_wei = transferEventVars[i].value;
        }
      }

      eventData.transfer_events.push(transferEvent);
    }

    return eventData;
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