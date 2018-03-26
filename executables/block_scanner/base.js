"use strict";

/**
 * This is the base class for block scanners
 *
 * @module executables/block_scanner/base
 *
 */

const fs = require('fs')
  , Web3 = require('web3')
;

const rootPrefix = '../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , TransactionLogModelKlass = require(rootPrefix + '/app/models/transaction_log')
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
  oThis.shortlistedTxHashes = null;
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
        oThis.shortlistedTxHashes = [];
        oThis.transactionInfo = {};

        await oThis.refreshHighestBlock();

        // return if nothing more to do.
        if (oThis.highestBlock - oThis.INTENTIONAL_BLOCK_DELAY <= oThis.lastProcessedBlock) return oThis.schedule();

        oThis.currentBlock = oThis.scannerData.lastProcessedBlock + 1;

        const currentBlock = await oThis.web3Provider.eth.getBlock(oThis.currentBlock);

        if (!currentBlock) return oThis.schedule();

        await oThis.shortlistTransactions(currentBlock.transactions);

        await oThis.fetchTransactionReceipts();

        await oThis.fetchTransaction();

        await oThis.updateTransactionLogs();

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
      , waitingForMiningStatus = new TransactionLogModelKlass().invertedStatuses[transactionLogConst.waitingForMiningStatus]
    ;

    var batchNo = 1;

    while(true) {
      const offset = (batchNo - 1) * batchSize
        , batchedTxHashes = allTxHashes.slice(offset, batchSize)
      ;

      if(batchedTxHashes.length === 0) break;

      const batchedTxLogRecords = await new TransactionLogModelKlass()
        .select('transaction_hash, transaction_uuid, process_uuid, status')
        .where(['transaction_hash in (?)', batchedTxHashes])
        .fire();

      if(batchedTxLogRecords.length === 0) continue;

      for(var i = 0; i < batchedTxLogRecords.length - 1; i ++) {
        const currRecord = batchedTxLogRecords[i];
        if(currRecord.transaction_uuid !== currRecord.process_uuid) continue;

        if(currRecord.status !== waitingForMiningStatus) continue;

        oThis.shortlistedTxHashes.push(currRecord.transaction_hash);
      }

      batchNo = batchNo + 1;
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
        , batchedTxHashes = oThis.shortlistedTxHashes.slice(offset, batchSize)
        , promiseArray = []
      ;

      if(batchedTxHashes.length === 0) break;

      for(var i = 0; i < batchedTxHashes.length - 1; i ++) {
        const currTxHash = batchedTxHashes[i];
        promiseArray.push(oThis.web3Provider.eth.getTransactionReceipt(currTxHash))
      }

      const txReceiptResults = Promise.all(promiseArray);





      batchNo = batchNo + 1;
    }

    return Promise.resolve();
  },

  fetchTransaction: function (shortlistedTxHashes) {
  },

  updateTransactionLogs: function () {

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

    setTimeout(function () {
      oThis.checkForNewBlocks();
    }, 5000);
  },

  /**
   * Re init
   */
  reInit: function () {
    const oThis = this
    ;

    setTimeout(function () {
      oThis.init();
    }, 5000);
  },

  /**
   * Update intercom data file
   */
  updateIntercomDataFile: function () {
    const oThis = this
    ;

    oThis.scannerData.lastProcessedBlock = oThis.toBlock;

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