"use strict";

/**
 * This is the base class for block scanners
 *
 * @module executables/block_scanner/execute_transaction
 *
 */

const fs = require('fs')
  , Web3 = require('web3')
;

const rootPrefix = '../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
;

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
      console.log('Exiting Process....');
      process.exit(1);
    }

    const processNewBlocksAsync = async function () {
      try {
        oThis.shortlistedTxObjs = [];
        oThis.transactionInfo = {};

        await oThis.refreshHighestBlock();

        // return if nothing more to do.
        if (oThis.highestBlock - oThis.INTENTIONAL_BLOCK_DELAY <= oThis.lastProcessedBlock) return oThis.schedule();

        oThis.currentBlock = oThis.scannerData.lastProcessedBlock + 1;

        logger.log('currentBlock =', oThis.currentBlock);

        const currentBlock = await oThis.web3Provider.eth.getBlock(oThis.currentBlock);

        if (!currentBlock) return oThis.schedule();

        await oThis.shortlistTransactions(currentBlock.transactions);

        await oThis.fetchTransactionReceipts();

        await oThis.updateTransactionLogs();

        oThis.updateScannerDataFile();

        oThis.schedule();
      } catch (err) {
        logger.info('Exception got:', err);

        if (oThis.interruptSignalObtained) {
          console.log('Exiting Process....');
          process.exit(1);
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
        , batchedTxHashes = allTxHashes.slice(offset, batchSize)
      ;

      batchNo = batchNo + 1;

      if(batchedTxHashes.length === 0) break;

      const batchedTxLogRecords = await new TransactionLogModel()
        .select('id, transaction_hash, transaction_uuid, process_uuid, status')
        .where(['transaction_hash in (?)', batchedTxHashes])
        .fire();

      if(batchedTxLogRecords.length === 0) continue;

      for(var i = 0; i < batchedTxLogRecords.length - 1; i ++) {
        const currRecord = batchedTxLogRecords[i];
        if(currRecord.transaction_uuid !== currRecord.process_uuid) continue;

        if(currRecord.status !== waitingForMiningStatus) continue;

        oThis.shortlistedTxObjs.push(
          {
            transaction_hash: currRecord.transaction_hash,
            id: currRecord.id
          });
      }

      console.log('----------');
    }

    return Promise.resolve();
  },

  fetchTransactionReceipts: async function () {
    const oThis = this
      , batchSize = 100
    ;

    var batchNo = 1;

    while(true) {
      const offset = (batchNo - 1) * batchSize
        , batchedTxObjs = oThis.shortlistedTxObjs.slice(offset, batchSize)
        , promiseArray = []
      ;

      batchNo = batchNo + 1;

      if(batchedTxObjs.length === 0) break;

      for(var i = 0; i < batchedTxObjs.length - 1; i ++) {
        const currTxHash = batchedTxObjs[i].transaction_hash;
        promiseArray.push(oThis.web3Provider.eth.getTransactionReceipt(currTxHash))
      }

      const txReceiptResults = await Promise.all(promiseArray);

      for(var i = 0; i < batchedTxObjs.length - 1; i ++) {
        const txReceipt = txReceiptResults[i];
        batchedTxObjs[i].gas_used = txReceipt.gasUsed;
      }
      
      // TODO: decode receipts and put the commission amount.
    }

    return Promise.resolve();
  },

  updateTransactionLogs: async function () {
    const oThis = this
      , batchSize = 100
      , promiseArray = []
      , completeStatus = new TransactionLogModel().invertedStatuses[transactionLogConst.completeStatus]
    ;

    var batchNo = 1;

    while(true) {
      const offset = (batchNo - 1) * batchSize
        , batchedTxObjs = oThis.shortlistedTxObjs.slice(offset, batchSize)
        , batchedTxLogId = []
      ;

      batchNo = batchNo + 1;

      if(batchedTxObjs.length === 0) break;

      // TODO - put the transaction gas used in the new table.

      for(var i = 0; i < batchedTxObjs.length - 1; i ++) {
        batchedTxLogId.push(batchedTxObjs[i].id);
      }

      promiseArray.push(new TransactionLogModel().where(['id in (?)', batchedTxLogId]).update({status: completeStatus}).fire());
    }

    await Promise.all(promiseArray);

    return Promise.resolve();
  },

  /**
   * Register interrupt signal handlers
   *
   */
  registerInterruptSignalHandlers: function () {
    const oThis = this;

    process.on('SIGINT', function () {
      console.log("Received SIGINT, cancelling block scaning");
      oThis.interruptSignalObtained = true;
    });

    process.on('SIGTERM', function () {
      console.log("Received SIGTERM, cancelling block scaning");
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
    const waitInterval = (oThis.highestBlock - oThis.INTENTIONAL_BLOCK_DELAY <= oThis.lastProcessedBlock) ? 2000 : 10;

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

    if (oThis.interruptSignalObtained) {
      console.log('Exiting Process....');
      process.exit(1);
    }
  },

  /**
   * Get highest block
   */
  refreshHighestBlock: async function () {
    const oThis = this
    ;

    oThis.highestBlock = await oThis.web3Provider.eth.getBlockNumber();

    return Promise.resolve();
  }
};

module.exports = BlockScannerBaseKlass;