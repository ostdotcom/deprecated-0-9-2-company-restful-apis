'use strict';

/**
 * This code acts as a master process to block scanner, which delegates the transactions from a block to block scanner worker processes
 *
 * Usage: node executables/block_scanner/transaction_delegator.js group_id datafilePath [benchmarkFilePath]
 *
 * Command Line Parameters Description:
 * group_id: group_id to fetch config strategy
 * datafilePath: path to the file which is storing the last block scanned info.
 * [benchmarkFilePath]: path to the file which is storing the benchmarking info.
 *
 * @module executables/block_scanner/transaction_delegator
 */

const rootPrefix = '../..';

const openSTNotification = require('@openstfoundation/openst-notification');

const MAX_TXS_PER_WORKER = 60;

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  ProcessLocker = new ProcessLockerKlass();

require(rootPrefix + '/lib/cache_multi_management/erc20_contract_address');
require(rootPrefix + '/lib/web3/interact/ws_interact');

// Command line arguments.
const args = process.argv,
  group_id = args[2],
  datafilePath = args[3],
  benchmarkFilePath = args[4];

let configStrategy = {};

// Usage demo.
const usageDemo = function() {
  logger.log(
    'usage:',
    'node ./executables/block_scanner/transaction_delegator.js group_id datafilePath [benchmarkFilePath]'
  );
  logger.log('* group_id is needed to fetch config strategy.');
  logger.log('* datafilePath is the path to the file which is storing the last block scanned info.');
  logger.log('* benchmarkFilePath is the path to the file which is storing the benchmarking info. (Optional)');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!group_id) {
    logger.error('group_id is not passed');
    usageDemo();
    process.exit(1);
  }

  if (!datafilePath) {
    logger.error('Data file path is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

// Check if another process with the same title is running.
ProcessLocker.canStartProcess({
  process_title: 'executables_transaction_delegator_' + group_id
});

const TransactionDelegator = function(params) {
  const oThis = this;

  oThis.filePath = params.file_path;
  oThis.benchmarkFilePath = params.benchmark_file_path;
  oThis.currentBlock = 0;
  oThis.scannerData = {};
  oThis.interruptSignalObtained = false;
  oThis.highestBlock = 0;
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

    // Read the lastProcessedBlock from the dataFile
    oThis.scannerData = JSON.parse(fs.readFileSync(oThis.filePath).toString());

    await oThis.warmUpWeb3Pool();

    oThis.checkForNewBlocks();
  },

  /**
   * Warm up web3 pool.
   */
  warmUpWeb3Pool: async function() {
    const oThis = this,
      utilityGethType = 'read_only',
      strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(utilityGethType);

    configStrategy = configStrategyResp.data;
    oThis.ic = new InstanceComposer(configStrategy);

    let web3InteractFactory = oThis.ic.getWeb3InteractHelper();

    let web3PoolSize = coreConstants.OST_WEB3_POOL_SIZE;

    for (let ind = 0; ind < configStrategy.OST_UTILITY_GETH_WS_PROVIDERS.length; ind++) {
      let provider = configStrategy.OST_UTILITY_GETH_WS_PROVIDERS[ind];
      for (let i = 0; i < web3PoolSize; i++) {
        web3InteractFactory.getInstance('utility', provider);
      }
    }
  },

  /**
   * Check for new blocks
   */
  checkForNewBlocks: async function() {
    const oThis = this;

    const processNewBlocksAsync = async function() {
      try {
        oThis.initParams();

        await oThis.getGethsWithCurrentBlock();

        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('getGethsWithCurrentBlock-' + (Date.now() - oThis.startTime) + 'ms');

        // return if nothing more to do, as of now.
        if (oThis.gethArray.length === 0) return oThis.schedule();

        oThis.currentBlock = oThis.scannerData.lastProcessedBlock + 1;

        logger.log('Current Block =', oThis.currentBlock);

        await oThis.distributeTransactions();

        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('distributeTransactions-' + (Date.now() - oThis.startTime) + 'ms');

        oThis.updateScannerDataFile();

        if (oThis.benchmarkFilePath) {
          oThis.granularTimeTaken.push('updateScannerDataFile-' + (Date.now() - oThis.startTime) + 'ms');
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
      logger.error('executables/block_scanner/transaction_delegator.js::processNewBlocksAsync::catch');
      logger.error(error);

      // TODO - error handling to be introduced to avoid double settlement.
      oThis.schedule();
    });
  },

  /**
   * Init params.
   */
  initParams: function() {
    const oThis = this;

    oThis.startTime = Date.now();
    oThis.granularTimeTaken = [];
    oThis.gethArray = [];
  },

  /**
   * Get Geth servers array with the current block
   */
  getGethsWithCurrentBlock: async function() {
    const oThis = this;

    for (let ind = 0; ind < configStrategy.OST_UTILITY_GETH_WS_PROVIDERS.length; ind++) {
      let provider = configStrategy.OST_UTILITY_GETH_WS_PROVIDERS[ind];
      let highestBlockOfProvider = await oThis.refreshHighestBlock(provider);

      if (oThis.benchmarkFilePath) {
        oThis.granularTimeTaken.push('refreshHighestBlock-' + (Date.now() - oThis.startTime) + 'ms');
      }

      if (highestBlockOfProvider - oThis.INTENTIONAL_BLOCK_DELAY > oThis.scannerData.lastProcessedBlock) {
        oThis.gethArray.push(provider);
      }
    }
  },

  /**
   * Distribute transactions to different queues
   *
   */
  distributeTransactions: async function() {
    const oThis = this;

    const web3InteractFactory = oThis.ic.getWeb3InteractHelper();
    let web3Interact = web3InteractFactory.getInstance('utility', oThis.gethArray[0]);

    oThis.currentBlockInfo = await web3Interact.getBlock(oThis.currentBlock);

    if (oThis.benchmarkFilePath) oThis.granularTimeTaken.push('eth.getBlock-' + (Date.now() - oThis.startTime) + 'ms');

    let totalTransactionCount = oThis.currentBlockInfo.transactions.length,
      perBatchCount = totalTransactionCount / oThis.gethArray.length,
      offset = 0;

    let noOfBatches = parseInt(totalTransactionCount / perBatchCount);
    noOfBatches += totalTransactionCount % perBatchCount ? 1 : 0;

    // capping the per batch count
    perBatchCount = perBatchCount > MAX_TXS_PER_WORKER ? MAX_TXS_PER_WORKER : perBatchCount;

    let loopCount = 0;

    while (loopCount < noOfBatches) {
      let txHashes = oThis.currentBlockInfo.transactions.slice(offset, offset + perBatchCount);

      offset = offset + perBatchCount;

      if (txHashes.length === 0) break;

      let chain_id = oThis.ic.configStrategy.OST_UTILITY_CHAIN_ID;

      let messageParams = {
        topics: ['block_scanner_execute_' + chain_id],
        publisher: 'OST',
        message: {
          kind: 'background_job',
          payload: {
            transactionHashes: txHashes,
            gethArray: oThis.gethArray,
            blockNumber: oThis.currentBlock,
            timestamp: oThis.currentBlockInfo.timestamp,
            delegatorTimestamp: oThis.startTime
          }
        }
      };

      let setToRMQ = await openSTNotification.publishEvent.perform(messageParams);

      //if could not set to RMQ run in async.
      if (setToRMQ.isFailure() || setToRMQ.data.publishedToRmq === 0) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'e_bs_td_1',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }
      loopCount++;
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
    const benchmarkData = [oThis.currentBlock, oThis.currentBlockInfo.transactions.length];

    fs.appendFileSync(oThis.benchmarkFilePath, benchmarkData.concat(oThis.granularTimeTaken).join(',') + '\n', function(
      err
    ) {
      if (err) logger.error(err);
    });
  },

  /**
   * Get highest block
   */
  refreshHighestBlock: async function(provider) {
    const oThis = this;

    const web3InteractFactory = oThis.ic.getWeb3InteractHelper();

    let web3Interact = web3InteractFactory.getInstance('utility', provider);

    let highestBlockOfProvider = await web3Interact.getBlockNumber();

    if (highestBlockOfProvider > oThis.highestBlock) {
      oThis.highestBlock = highestBlockOfProvider;
    }

    logger.win('* Obtained highest block on', provider, 'as', oThis.highestBlock);

    return Promise.resolve(highestBlockOfProvider);
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
