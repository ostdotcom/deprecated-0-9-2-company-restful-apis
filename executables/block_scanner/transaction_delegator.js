'use strict';

/**
 * This code acts as a master process to block scanner, which delegates the transactions from a block to block scanner worker processes
 *
 * Usage: node executables/block_scanner/transaction_delegator.js processLockId datafilePath group_id [benchmarkFilePath]
 *
 * Command Line Parameters Description:
 * processLockId: processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.
 * datafilePath: path to the file which is storing the last block scanned info.
 * group_id: group_id to fetch config strategy
 * [benchmarkFilePath]: path to the file which is storing the benchmarking info.
 *
 * @module executables/block_scanner/transaction_delegator
 */

const rootPrefix = '../..';

const openSTNotification = require('@openstfoundation/openst-notification');

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  configStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_multi_management/client_config_strategies'),
  ProcessLocker = new ProcessLockerKlass();

require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/lib/providers/payments');
require(rootPrefix + '/lib/providers/storage');
require(rootPrefix + '/app/models/transaction_log');
require(rootPrefix + '/lib/cache_multi_management/erc20_contract_address');
require(rootPrefix + '/lib/web3/interact/ws_interact');

// Command line arguments.
const args = process.argv,
  processLockId = args[2],
  datafilePath = args[3],
  group_id = args[4],
  benchmarkFilePath = args[5];

let configStrategy = {};

// Usage demo.
const usageDemo = function() {
  logger.log(
    'usage:',
    'node ./executables/block_scanner/for_tx_status_and_balance_sync.js processLockId datafilePath group_id [benchmarkFilePath]'
  );
  logger.log(
    '* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.'
  );
  logger.log('* datafilePath is the path to the file which is storing the last block scanned info.');
  logger.log('* group_id is needed to fetch config strategy.');
  logger.log('* benchmarkFilePath is the path to the file which is storing the benchmarking info.');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
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

  if (!group_id) {
    logger.error('group_id is not passed');
    usageDemo();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

// Check if another process with the same title is running.
ProcessLocker.canStartProcess({ process_title: 'executables_transaction_delegator_' + processLockId });

const fs = require('fs'),
  abiDecoder = require('abi-decoder'),
  BigNumber = require('bignumber.js'),
  uuid = require('uuid');

const responseHelper = require(rootPrefix + '/lib/formatter/response'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  TransactionMeta = require(rootPrefix + '/app/models/transaction_meta'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address');

const TransactionDelegator = function(params) {
  const oThis = this;

  oThis.filePath = params.file_path;
  oThis.benchmarkFilePath = params.benchmark_file_path;
  oThis.currentBlock = 0;
  oThis.scannerData = {};
  oThis.interruptSignalObtained = false;
  oThis.highestBlock = null;

  oThis.TransferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  oThis.ProcessedMintEventSignature = '0x96989a6b1d8c3bb8d6cc22e14b188b5c14b1f33f34ff07ea2e4fd6d880dac2c7';
  oThis.RevertedMintEventSignature = '0x86e6b95641fbf0f8939eb3da2e7e26aee0188048353d08a45c78218e84cf1d4f';

  oThis.ZeroXAddress = '0x0000000000000000000000000000000000000000';

  oThis.tokenTransferKind = new TransactionMeta().invertedKinds[transactionLogConst.tokenTransferTransactionType];
  oThis.stpTransferKind = new TransactionMeta().invertedKinds[transactionLogConst.stpTransferTransactionType];

  oThis.failedTxStatus = transactionLogConst.invertedStatuses[transactionLogConst.failedStatus];
  oThis.completeTxStatus = transactionLogConst.invertedStatuses[transactionLogConst.completeStatus];
};

TransactionDelegator.prototype = {
  /**
   * Intentional block delay.
   */
  INTENTIONAL_BLOCK_DELAY: 0,

  /**
   * Starts the process of the script with initializing processor.
   */
  init: async function() {
    const oThis = this;

    // Read this from a file.
    oThis.scannerData = JSON.parse(fs.readFileSync(oThis.filePath).toString());

    await oThis.warmUpWeb3Pool();

    oThis.checkForNewBlocks();
  },

  /**
   * Warm up web3 pool.
   */
  warmUpWeb3Pool: async function() {
    const oThis = this,
      strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash();

    configStrategy = configStrategyResp.data;
    oThis.ic = new InstanceComposer(configStrategy);

    let web3InteractFactory = oThis.ic.getWeb3InteractHelper();

    let web3PoolSize = coreConstants.OST_WEB3_POOL_SIZE;

    oThis.geth_count = configStrategy.OST_UTILITY_GETH_WS_PROVIDERS.length;

    for (let ind = 0; ind < oThis.geth_count; ind++) {
      for (let i = 0; i < web3PoolSize; i++) {
        web3InteractFactory.getInstance('utility', ind);
      }
    }
  },

  /**
   * Init params.
   */
  initParams: function() {
    const oThis = this;

    oThis.startTime = Date.now();

    oThis.granularTimeTaken = [];
  },

  checkForNewBlocks: async function() {
    const oThis = this;
    const processNewBlocksAsync = async function() {
      try {
        oThis.initParams();

        await oThis.getGethsWithCurrentBlock();

        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('getGethsWithCurrentBlock-' + (Date.now() - oThis.startTime) + 'ms');

        oThis.currentBlock = oThis.scannerData.lastProcessedBlock + 1;

        logger.log('Current Block =', oThis.currentBlock);

        await oThis.distributeTransactions();

        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('distributeTransactions-' + (Date.now() - oThis.startTime) + 'ms');

        oThis.updateScannerDataFile();

        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('updateScannerDataFile-' + (Date.now() - oThis.startTime) + 'ms');

        if (oThis.benchmarkFilePath) {
          oThis.updateBenchmarkFile();
          oThis.granularTimeTaken.push('updateBenchmarkFile-' + (Date.now() - oThis.startTime) + 'ms');
        }
        oThis.schedule();
      } catch (err) {
        logger.error('Exception:', err);

        if (oThis.interruptSignalObtained) {
          logger.win('* Exiting Process after interrupt signal obtained.');
          process.exit(1);
        } else {
          oThis.reInit();
        }
      }
    };

    await processNewBlocksAsync().catch(function(error) {
      logger.error('executables/block_scanner/base.js::processNewBlocksAsync::catch');
      logger.error(error);

      oThis.schedule();
    });
  },

  /**
   * Get geth array with the block
   *
   */
  getGethsWithCurrentBlock: async function() {
    const oThis = this;

    oThis.gethArray = [];

    for (let ind = 0; ind < oThis.geth_count; ind++) {
      await oThis.refreshHighestBlock(ind);

      if (oThis.benchmarkFilePath)
        oThis.granularTimeTaken.push('refreshHighestBlock-' + (Date.now() - oThis.startTime) + 'ms');

      if (oThis.highestBlock - oThis.INTENTIONAL_BLOCK_DELAY > oThis.scannerData.lastProcessedBlock)
        oThis.gethArray.push(configStrategy.OST_UTILITY_GETH_WS_PROVIDERS[ind]);
    }
    // return if nothing more to do, as of now.
    if (oThis.gethArray.length == 0) return oThis.schedule();
  },

  /**
   * Distribute transactions to different queues
   *
   */

  distributeTransactions: async function() {
    const oThis = this;

    const web3InteractFactory = oThis.ic.getWeb3InteractHelper();
    let web3Interact = web3InteractFactory.getInstance('utility', 0);

    oThis.currentBlockInfo = await web3Interact.getBlock(oThis.currentBlock);

    if (oThis.benchmarkFilePath) oThis.granularTimeTaken.push('eth.getBlock-' + (Date.now() - oThis.startTime) + 'ms');

    let total_transaction_count = oThis.currentBlockInfo.transactions.length,
      per_geth_tx_count = total_transaction_count / oThis.gethArray.length,
      offset = 0;

    for (let ind = 0; ind < oThis.gethArray.length; ind++) {
      let txHashes = oThis.currentBlockInfo.transactions.slice(offset, offset + per_geth_tx_count);
      offset = offset + per_geth_tx_count;

      if (ind == oThis.gethArray.length - 1) {
        let remainingTxs = oThis.currentBlockInfo.transactions.slice(offset, total_transaction_count);
        txHashes = txHashes.concat(remainingTxs);
      }

      if (txHashes.length == 0) break;

      let messageParams = {
        topics: ['block_scanner_execute_' + group_id],
        publisher: 'OST',
        message: {
          kind: 'background_job',
          payload: {
            transactionHashes: txHashes,
            provider: oThis.gethArray[ind],
            blockNumber: oThis.currentBlock
          }
        }
      };

      let setToRMQ = await openSTNotification.publishEvent.perform(messageParams);

      //if could not set to RMQ run in async.
      if (setToRMQ.isFailure() || setToRMQ.data.publishedToRmq == 0) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'e_bs_td_1',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }
    }
  },

  /**
   * Register interrupt signal handlers
   */
  registerInterruptSignalHandlers: function() {
    const oThis = this;

    process.on('SIGINT', function() {
      logger.win('* Received SIGINT. Signal registerred.');
      oThis.interruptSignalObtained = true;
    });

    process.on('SIGTERM', function() {
      logger.win('* Received SIGTERM. Signal registerred.');
      oThis.interruptSignalObtained = true;
    });
  },

  /**
   * Schedule
   */
  schedule: function() {
    const oThis = this;

    // if the current block is far behind the highest block, schedule for 10 ms otherwise schedule for 2 s
    const waitInterval =
      oThis.highestBlock - oThis.INTENTIONAL_BLOCK_DELAY <= oThis.scannerData.lastProcessedBlock ? 2000 : 10;

    logger.win('* Scheduled checkForNewBlocks after', waitInterval / 1000.0, 'seconds.');

    logger.log('------------------------------------------------');

    setTimeout(function() {
      oThis.checkForNewBlocks();
    }, waitInterval);
  },

  /**
   * Re init
   */
  reInit: function() {
    const oThis = this;

    setTimeout(function() {
      oThis.init();
    }, 1000);
  },

  /**
   * Update scanner data file
   */
  updateScannerDataFile: function() {
    const oThis = this;

    oThis.scannerData.lastProcessedBlock = oThis.currentBlock;

    fs.writeFileSync(oThis.filePath, JSON.stringify(oThis.scannerData), function(err) {
      if (err) logger.error(err);
    });

    logger.win('* Updated last processed block = ', oThis.scannerData.lastProcessedBlock);

    if (oThis.interruptSignalObtained) {
      logger.win('* Exiting Process after interrupt signal obtained.');
      process.exit(1);
    }
  },

  /**
   * Update executation statistics to benchmark file.
   */
  updateBenchmarkFile: function() {
    const oThis = this;
    const benchmarkData = [
      oThis.currentBlock,
      oThis.currentBlockInfo.transactions.length,
      oThis.recognizedTxHashes.length,
      oThis.unRecognizedTxHashes.length
    ];

    fs.appendFileSync(oThis.benchmarkFilePath, benchmarkData.concat(oThis.granularTimeTaken).join(',') + '\n', function(
      err
    ) {
      if (err) logger.error(err);
    });
  },

  /**
   * Get highest block
   */
  refreshHighestBlock: async function(ind) {
    const oThis = this;

    const web3InteractFactory = oThis.ic.getWeb3InteractHelper();

    let web3Interact = web3InteractFactory.getInstance('utility', ind);

    oThis.highestBlock = await web3Interact.getBlockNumber();

    logger.win('* Obtained highest block:', oThis.highestBlock);

    return Promise.resolve();
  }
};

const blockScannerMasterObj = new TransactionDelegator({
  file_path: datafilePath,
  benchmark_file_path: benchmarkFilePath
});
blockScannerMasterObj.registerInterruptSignalHandlers();
blockScannerMasterObj.init().then(function(r) {
  logger.win('Blockscanner Master Process Started');
});
