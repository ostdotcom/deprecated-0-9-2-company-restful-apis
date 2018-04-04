"use strict";

/**
 * This is the base class for block scanners
 *
 * @module executables/block_scanner/execute_transaction
 *
 */

const fs = require('fs')
  , Web3 = require('web3')
  , abiDecoder = require('abi-decoder')
  , openStPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = '../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
;

const coreAbis = openStPlatform.abis
;

abiDecoder.addABI(coreAbis.airdrop);
abiDecoder.addABI(coreAbis.brandedToken);

const BlockScannerBaseKlass = function (params) {
  const oThis = this
  ;

  oThis.filePath = params.file_path;

  oThis.currentBlock = 0;

  oThis.scannerData = {};
  oThis.interruptSignalObtained = false;

  oThis.highestBlock = null;
  oThis.shortlistedTxObjs = null;
  oThis.transactionInfo = null;
};

BlockScannerBaseKlass.prototype = {

  /**
   * Intentional block delay
   */
  INTENTIONAL_BLOCK_DELAY: 1,

  /**
   * Starts the process of the script with initializing processor
   *
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
   *
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
        oThis.shortlistedTxObjs = [];
        oThis.transactionInfo = {};

        await oThis.refreshHighestBlock();

        // return if nothing more to do.
        if (oThis.highestBlock - oThis.INTENTIONAL_BLOCK_DELAY <= oThis.scannerData.lastProcessedBlock) return oThis.schedule();

        oThis.currentBlock = oThis.scannerData.lastProcessedBlock + 1;

        logger.log('Current Block =', oThis.currentBlock);

        const currentBlock = await oThis.web3Provider.eth.getBlock(oThis.currentBlock);

        if (!currentBlock) return oThis.schedule();

        await oThis.shortlistTransactions(currentBlock.transactions);

        if(oThis.shortlistedTxObjs.length === 0) {
          oThis.updateScannerDataFile();
          return oThis.schedule();
        }

        await oThis.fetchTransactionReceipts();

        await oThis.updateTransactionLogs();

        oThis.updateScannerDataFile();

        oThis.schedule();
      } catch (err) {
        logger.info('Exception got:', err);

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

  shortlistTransactions: async function (allTxHashes) {
    const oThis = this
      , batchSize = 100
      , waitingForMiningStatus = new TransactionLogModel().invertedStatuses[transactionLogConst.waitingForMiningStatus]
    ;

    var batchNo = 1;

    while(true) {
      const offset = (batchNo - 1) * batchSize
        , batchedTxHashes = allTxHashes.slice(offset, batchSize + offset)
      ;

      batchNo = batchNo + 1;

      if(batchedTxHashes.length === 0) break;

      const batchedTxLogRecords = await new TransactionLogModel()
        .select('id, transaction_hash, transaction_uuid, process_uuid, status')
        .where(['transaction_hash in (?)', batchedTxHashes])
        .fire();

      if(batchedTxLogRecords.length === 0) continue;

      for(var i = 0; i < batchedTxLogRecords.length; i ++) {
        const currRecord = batchedTxLogRecords[i];

        if(currRecord.transaction_uuid !== currRecord.process_uuid) continue;

        if(currRecord.status != waitingForMiningStatus) continue;

        oThis.shortlistedTxObjs.push(
          {
            transaction_hash: currRecord.transaction_hash,
            id: currRecord.id
          });
      }
    }

    logger.log('Number of relevant transactions =', oThis.shortlistedTxObjs.length);

    return Promise.resolve();
  },

  fetchTransactionReceipts: async function () {
    const oThis = this
      , batchSize = 100
    ;

    var batchNo = 1;

    while(true) {
      const offset = (batchNo - 1) * batchSize
        , batchedTxObjs = oThis.shortlistedTxObjs.slice(offset, batchSize + offset)
        , promiseArray = []
      ;

      batchNo = batchNo + 1;

      if(batchedTxObjs.length === 0) break;

      for(var i = 0; i < batchedTxObjs.length; i ++) {
        const currTxHash = batchedTxObjs[i].transaction_hash;
        promiseArray.push(oThis.web3Provider.eth.getTransactionReceipt(currTxHash))
      }

      const txReceiptResults = await Promise.all(promiseArray);

      for(var i = 0; i < batchedTxObjs.length; i ++) {
        const txReceipt = txReceiptResults[i];
        const decodedEvents = abiDecoder.decodeLogs(txReceipt.logs);

        const eventData = oThis._getEventData(decodedEvents);

        batchedTxObjs[i].commission_amount_in_wei = eventData._commissionTokenAmount;
        batchedTxObjs[i].bt_transfer_in_wei = eventData._tokenAmount;
        batchedTxObjs[i].gas_used = txReceipt.gasUsed;
        batchedTxObjs[i].status = parseInt(txReceipt.status, 16);
      }

    }

    logger.win('* Fetching Tx Receipts DONE');

    return Promise.resolve();
  },

  updateTransactionLogs: async function () {
    const oThis = this
      , batchSize = 100
      , completeStatus = new TransactionLogModel().invertedStatuses[transactionLogConst.completeStatus]
      , failedStatus = new TransactionLogModel().invertedStatuses[transactionLogConst.failedStatus]
    ;

    var batchNo = 1;

    while(true) {
      const offset = (batchNo - 1) * batchSize
        , batchedTxObjs = oThis.shortlistedTxObjs.slice(offset, batchSize + offset)
        , promiseArray = []
      ;

      batchNo = batchNo + 1;

      if(batchedTxObjs.length === 0) break;

      for(var i = 0; i < batchedTxObjs.length; i++) {
        const formattedReceipt = JSON.stringify({
          gas_used: batchedTxObjs[i].gas_used,
          commission_amount_in_wei: batchedTxObjs[i].commission_amount_in_wei,
          bt_transfer_in_wei: batchedTxObjs[i].bt_transfer_in_wei,
          block_number: oThis.currentBlock
        });

        const status = (batchedTxObjs[i].status == 1) ? completeStatus : failedStatus;

        promiseArray.push(new TransactionLogModel().update({status: status, formatted_receipt: formattedReceipt})
          .where(['id = ?', batchedTxObjs[i].id]).fire());
      }

      await Promise.all(promiseArray);
    }

    logger.win('* Updating transaction_logs table DONE');

    return Promise.resolve();
  },

  /**
   * Register interrupt signal handlers
   *
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

    logger.win('* Scheduled checkForNewBlocks after', waitInterval/1000.0, 'seconds.');

    logger.log('------------------------------------------------');

    setTimeout(
      function () {oThis.checkForNewBlocks();},
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
      function () {oThis.init();},
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
    const eventData = {_tokenAmount: '0', _commissionTokenAmount: '0'};

    if(!decodedEvents || decodedEvents.length === 0) {
      return eventData;
    }

    var airdropPaymentEventVars = null;

    for(var i = 0; i < decodedEvents.length; i++) {
      if (decodedEvents[i].name == 'AirdropPayment') {
        airdropPaymentEventVars = decodedEvents[i].events;
        break;
      }
    }

    if(!airdropPaymentEventVars || airdropPaymentEventVars.length === 0) {
      return eventData;
    }

    for(var i = 0; i < airdropPaymentEventVars.length; i++) {
      if (airdropPaymentEventVars[i].name == '_commissionTokenAmount') {
        eventData._commissionTokenAmount = airdropPaymentEventVars[i].value;
      }

      if (airdropPaymentEventVars[i].name == '_tokenAmount') {
        eventData._tokenAmount = airdropPaymentEventVars[i].value;
      }
    }

    return eventData;
  }
};

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/block_scanner/execute_transaction.js processLockId datafilePath');
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
  if(!processLockId) {
    logger.error('Process Lock id NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if(!datafilePath) {
    logger.error('Data file path is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

const blockScannerObj = new BlockScannerBaseKlass({file_path: datafilePath});
blockScannerObj.registerInterruptSignalHandlers();
blockScannerObj.init();