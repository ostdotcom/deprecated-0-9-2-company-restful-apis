'use strict';

/**
 * This code acts as a worker process for block scanner, which takes the transactions from delegator
 * and processes it using block scanner class. [ lib/block_scanner/for_tx_status_and_balance_sync.js ]
 *
 * Usage: node executables/rmq_subscribers/block_scanner.js processlockId group_id prefetchCountStr [benchmarkFilePath]
 *
 * Command Line Parameters Description:
 * processlockId: used for ensuring that no other process with the same processlockId can run on a given machine.
 * group_id: group_id to fetch config strategy
 * prefetchCountStr: prefetch count for RMQ subscribers.
 * [benchmarkFilePath]: path to the file which is storing the benchmarking info.
 *
 * @module executables/rmq_subscribers/block_scanner
 */

const rootPrefix = '../..';

const program = require('commander');

program
  .option('--processlock-id <processlockId>', 'Process Lock id')
  .option('--group-id <groupId>', 'Group id')
  .option('--prefetch-count <prefetchCount>', 'Prefetch Count')
  .option('--benchmark-file-path [benchmarkFilePath]', 'Path to benchmark file path');

program.on('--help', () => {
  console.log('');
  console.log('  Example:');
  console.log('');
  console.log(
    '    node ./executables/rmq_subscribers/block_scanner.js --processlock-id 1 --group-id 197 --prefetch-count 2 --benchmark-file-path [benchmarkFilePath]'
  );
  console.log('');
  console.log('');
});

program.parse(process.argv);

const InstanceComposer = require(rootPrefix + '/instance_composer'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  web3InteractFactory = require(rootPrefix + '/lib/web3/interact/ws_interact'),
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  ProcessLocker = new ProcessLockerKlass(program);

let ic = null;

require(rootPrefix + '/lib/block_scanner/for_tx_status_and_balance_sync');
require(rootPrefix + '/lib/web3/interact/ws_interact');

// Load external packages
const OSTBase = require('@openstfoundation/openst-base');

// Check if another process with the same title is running.
ProcessLocker.canStartProcess({
  process_title: 'executables_rmq_subscribers_block_scanner_' + program.groupId + '_' + program.processlockId
});

let unAckCount = 0,
  prefetchCountInt = parseInt(program.prefetchCount);

const BlockScanner = function() {
  const oThis = this;

  oThis.PromiseQueueManager = new OSTBase.OSTPromise.QueueManager(oThis._promiseExecutor, {
    name: 'blockscanner_promise_queue_manager',
    timeoutInMilliSecs: 3 * 60 * 1000, //3 minutes
    maxZombieCount: Math.round(prefetchCountInt * 0.25),
    onMaxZombieCountReached: function() {
      logger.warn('e_rmqs_bs_2', 'maxZombieCount reached. Triggering SIGTERM.');
      // Trigger gracefully shutdown of process.
      process.kill(process.pid, 'SIGTERM');
    }
  });

  SigIntHandler.call(oThis, {});
};

BlockScanner.prototype = Object.create(SigIntHandler.prototype);

const BlockScannerPrototype = {
  perform: async function() {
    const oThis = this;

    oThis.validateAndSanitize();

    await oThis.warmUpGethPool();

    oThis.startSubscription();
  },

  /**
   * validateAndSanitize
   */
  validateAndSanitize: function() {
    const oThis = this;
    if (!program.processlockId || !program.groupId || !program.prefetchCount) {
      program.help();
      process.exit(1);
    }
  },

  /**
   * warmUpGethPool
   *
   */
  warmUpGethPool: function() {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      let utilityGethType = 'read_only',
        strategyByGroupHelperObj = new StrategyByGroupHelper(program.groupId),
        configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(utilityGethType),
        configStrategy = configStrategyResp.data;

      ic = new InstanceComposer(configStrategy);

      let web3PoolSize = coreConstants.OST_WEB3_POOL_SIZE;

      for (let ind = 0; ind < configStrategy.OST_UTILITY_GETH_WS_PROVIDERS.length; ind++) {
        let provider = configStrategy.OST_UTILITY_GETH_WS_PROVIDERS[ind];
        for (let i = 0; i < web3PoolSize; i++) {
          web3InteractFactory.getInstance('utility', provider);
        }
      }

      return onResolve();
    });
  },

  /**
   * startSubscription
   */
  startSubscription: async function() {
    const oThis = this;

    let chain_id = ic.configStrategy.OST_UTILITY_CHAIN_ID;

    const openStNotification = await SharedRabbitMqProvider.getInstance();
    openStNotification.subscribeEvent.rabbit(
      ['block_scanner_execute_' + chain_id],
      {
        queue: 'block_scanner_execute_' + chain_id,
        ackRequired: 1,
        prefetch: prefetchCountInt
      },
      function(params) {
        // Promise is required to be returned to manually ack messages in RMQ
        return oThis.PromiseQueueManager.createPromise(params);
      }
    );
  },

  /**
   * _promiseExecutor
   *
   * @private
   */

  _promiseExecutor: function(onResolve, onReject, params) {
    const oThis = this;

    unAckCount++;

    // Process request
    // TODO: put try catch around JSON parse
    const parsedParams = JSON.parse(params);

    const payload = parsedParams.message.payload;

    let BlockScannerKlass = ic.getBlockScannerKlass(),
      blockScannerObj = new BlockScannerKlass({
        block_number: payload.blockNumber,
        geth_array: payload.gethArray,
        transaction_hashes: payload.transactionHashes,
        time_stamp: payload.timestamp,
        benchmark_file_path: program.benchmarkFilePath,
        web3_factory_obj: web3InteractFactory,
        delegator_timestamp: payload.delegatorTimestamp,
        process_id: program.processlockId
      });

    try {
      blockScannerObj
        .perform()
        .then(function() {
          unAckCount--;
          logger.debug('------ unAckCount -> ', unAckCount);
          // ack RMQ
          return onResolve();
        })
        .catch(function(err) {
          logger.error(
            'e_rmqs_bs_1',
            'Something went wrong in blockscanner execution. unAckCount ->',
            unAckCount,
            err,
            params
          );
          unAckCount--;
          // ack RMQ
          return onResolve();
        });
    } catch (err) {
      unAckCount--;
      logger.error('Listener could not process blockscanner.. Catch. unAckCount -> ', unAckCount);
    }
  },

  /**
   * pendingTasksDone
   */
  pendingTasksDone: function() {
    const oThis = this;

    if (unAckCount != oThis.PromiseQueueManager.getPendingCount()) {
      logger.error('ERROR :: unAckCount and pending counts are not in sync.');
    }
    if (!oThis.PromiseQueueManager.getPendingCount() && !unAckCount) {
      return true;
    }

    return false;
  }
};

Object.assign(BlockScanner.prototype, BlockScannerPrototype);

let blockScanner = new BlockScanner();
blockScanner.perform().catch(function(err) {
  logger.error(err);
});
