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

const program = require('commander'),
  fs = require('fs');

const MAX_TXS_PER_WORKER = 60,
  MIN_TXS_PER_WORKER = 10,
  FAILURE_CODE = -1;

const InstanceComposer = require(rootPrefix + '/instance_composer'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  web3InteractFactory = require(rootPrefix + '/lib/web3/interact/ws_interact'),
  ProcessLocker = new ProcessLockerKlass();

require(rootPrefix + '/lib/web3/interact/ws_interact');
require(rootPrefix + '/lib/cache_multi_management/erc20_contract_address');

let configStrategy = {};

const openSTNotification = SharedRabbitMqProvider.getInstance();

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!program.groupId || !program.dataFilePath) {
    program.help();
    process.exit(1);
  }
};

/**
 *
 * @param {Object} params
 * @param {String} params.dataFilePath
 * @param {String} params.benchmarkFilePath
 * @constructor
 */
const TransactionDelegator = function(params) {
  const oThis = this;

  oThis.filePath = params.dataFilePath;
  oThis.benchmarkFilePath = params.benchmarkFilePath;
  oThis.currentBlock = 0;
  oThis.scannerData = {};
  oThis.interruptSignalObtained = false;
  oThis.highestBlock = 0;
  oThis.canExit = true;

  SigIntHandler.call(oThis, {});
};

TransactionDelegator.prototype = Object.create(SigIntHandler.prototype);

const TransactionDelegatorPrototype = {
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
      strategyByGroupHelperObj = new StrategyByGroupHelper(program.groupId),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(utilityGethType);

    if (configStrategyResp.isFailure()) {
      logger.log('=====');
      process.exit(1);
    }

    configStrategy = configStrategyResp.data;
    oThis.ic = new InstanceComposer(configStrategy);

    let web3PoolSize = coreConstants.OST_WEB3_POOL_SIZE;

    logger.log('====Warming up geth pool for providers', configStrategy.OST_UTILITY_GETH_WS_PROVIDERS);

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
        if (oThis.gethArray.length === 0) {
          logger.info('==== No geths with block', oThis.scannerData.lastProcessedBlock + 1, '==rescheduling...');
          return oThis.schedule();
        }

        oThis.canExit = false;

        oThis.currentBlock = oThis.scannerData.lastProcessedBlock + 1;

        logger.log('Current Block =', oThis.currentBlock);

        let response = await oThis.distributeTransactions();

        if (oThis.benchmarkFilePath)
          oThis.granularTimeTaken.push('distributeTransactions-' + (Date.now() - oThis.startTime) + 'ms');

        // Do this before block number update in the file
        if (response == FAILURE_CODE) {
          oThis.canExit = true;
          return oThis.schedule();
        }

        oThis.updateScannerDataFile();

        if (oThis.benchmarkFilePath) {
          oThis.granularTimeTaken.push('updateScannerDataFile-' + (Date.now() - oThis.startTime) + 'ms');
          oThis.updateBenchmarkFile();
          oThis.granularTimeTaken.push('updateBenchmarkFile-' + (Date.now() - oThis.startTime) + 'ms');
        }

        oThis.schedule();
      } catch (err) {
        logger.error('Exception:', err);
        oThis.canExit = true;

        oThis.reInit(); // Restarts block scanning after 1 sec
      }
    };

    await processNewBlocksAsync().catch(function(error) {
      logger.error('executables/block_scanner/transaction_delegator.js::processNewBlocksAsync::catch');
      logger.error(error);

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

    logger.log('====Block', oThis.scannerData.lastProcessedBlock + 1, '==is found on ', oThis.gethArray);
  },

  /**
   * Distribute transactions to different queues
   *
   */
  distributeTransactions: async function() {
    const oThis = this;

    let web3Interact = web3InteractFactory.getInstance('utility', oThis.gethArray[0]);

    oThis.currentBlockInfo = await web3Interact.getBlock(oThis.currentBlock);

    if (!oThis.currentBlockInfo) {
      return FAILURE_CODE;
    }

    let totalTransactionCount = oThis.currentBlockInfo.transactions.length;
    if (totalTransactionCount === 0) return;

    if (oThis.benchmarkFilePath) oThis.granularTimeTaken.push('eth.getBlock-' + (Date.now() - oThis.startTime) + 'ms');

    let perBatchCount = totalTransactionCount / oThis.gethArray.length,
      offset = 0;

    // capping the per batch count
    perBatchCount = perBatchCount > MAX_TXS_PER_WORKER ? MAX_TXS_PER_WORKER : perBatchCount;
    perBatchCount = perBatchCount < MIN_TXS_PER_WORKER ? MIN_TXS_PER_WORKER : perBatchCount;

    let noOfBatches = parseInt(totalTransactionCount / perBatchCount);
    noOfBatches += totalTransactionCount % perBatchCount ? 1 : 0;

    logger.log('====Batch count', noOfBatches, '====Txs per batch', perBatchCount);

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
        logger.error("====Couldn't publish the message to RMQ====");
        return FAILURE_CODE;
      }

      logger.debug('===published======txHashes', txHashes, '====from block', oThis.currentBlock);
      logger.log('==== published', txHashes.length, 'transactions', '====from block', oThis.currentBlock);
      loopCount++;
    }
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
   * Re-initialize the delegator.
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

    oThis.canExit = true;
  },

  /**
   * Update execution statistics to benchmark file.
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
   *
   * @param {String} provider: gethProvider
   * @returns {Promise<any>}
   */
  refreshHighestBlock: async function(provider) {
    const oThis = this;

    let web3Interact = web3InteractFactory.getInstance('utility', provider);

    let highestBlockOfProvider = await web3Interact.getBlockNumber();

    if (highestBlockOfProvider > oThis.highestBlock) {
      oThis.highestBlock = highestBlockOfProvider;
    }

    logger.win('* Obtained highest block on', provider, 'as', oThis.highestBlock);

    return Promise.resolve(highestBlockOfProvider);
  },

  /**
   * Returns a boolean which checks whether all the pending tasks are done or not.
   *
   * @returns {boolean}
   */
  pendingTasksDone: function() {
    const oThis = this;

    return oThis.canExit;
  }
};

Object.assign(TransactionDelegator.prototype, TransactionDelegatorPrototype);

program
  .option('--group-id <groupId>', 'Group Id')
  .option('--data-file-path <dataFilePath>', 'Path to the file which contains the last processed block')
  .option('--benchmark-file-path [benchmarkFilePath]', 'Path to the file to store benchmark data. (Optional)');

program.on('--help', function() {
  console.log('  Example:');
  console.log('');
  console.log(
    '    node executables/block_scanner/transaction_delegator.js --group-id 197 --data-file-path /home/block_scanner.json --benchmark-file-path [/home/benchmark.csv]'
  );
  console.log('');
  console.log('');
});

program.parse(process.argv);

// Check if another process with the same title is running.
ProcessLocker.canStartProcess({
  process_title: 'executables_transaction_delegator_' + program.groupId
});

// Validate and sanitize the input params.
validateAndSanitize();

const blockScannerMasterObj = new TransactionDelegator(program);

blockScannerMasterObj.init().then(function(r) {
  logger.win('Blockscanner Master Process Started');
});
