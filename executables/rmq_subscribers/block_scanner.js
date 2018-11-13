'use strict';

/**
 * This code acts as a worker process for block scanner, which takes the transactions from delegator
 * and processes it using block scanner class. [ lib/block_scanner/for_tx_status_and_balance_sync.js ]
 *
 * Usage: node executables/rmq_subscribers/block_scanner.js --processLock-id 1 --group-id 197 --prefetch-count 2 --benchmark-file-path [benchmarkFilePath]
 *
 * Command Line Parameters Description:
 * processLockId: used for ensuring that no other process with the same processLockId can run on a given machine.
 * group_id: group_id to fetch config strategy
 * prefetchCountStr: prefetch count for RMQ subscribers.
 * [benchmarkFilePath]: path to the file which is storing the benchmarking info.
 *
 * @module executables/rmq_subscribers/block_scanner
 */

const rootPrefix = '../..';

const program = require('commander'),
  CronProcessesHandler = require(rootPrefix + '/lib/cron_processes_handler'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes'),
  CronProcessHandlerObject = new CronProcessesHandler();

program
  .option('--processLock-id <processLockId>', 'Process Lock id')
  .option('--group-id <groupId>', 'Group id')
  .option('--prefetch-count <prefetchCount>', 'Prefetch Count')
  .option('--benchmark-file-path [benchmarkFilePath]', 'Path to benchmark file path');

program.on('--help', () => {
  console.log('');
  console.log('  Example:');
  console.log('');
  console.log(
    '    node executables/rmq_subscribers/block_scanner.js --processLock-id 1 --group-id 197 --prefetch-count 2 --benchmark-file-path [benchmarkFilePath]'
  );
  console.log('');
  console.log('');
});

program.parse(process.argv);

const InstanceComposer = require(rootPrefix + '/instance_composer'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  web3InteractFactory = require(rootPrefix + '/lib/web3/interact/ws_interact'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id');

// Declare variables.
let ic = null,
  cronKind = CronProcessesConstants.blockScannerWorker;

// Check whether the cron can be started or not.
CronProcessHandlerObject.canStartProcess({
  id: +program.processLockId, // Implicit string to int conversion.
  cron_kind: cronKind
});

require(rootPrefix + '/lib/block_scanner/for_tx_status_and_balance_sync');
require(rootPrefix + '/lib/web3/interact/ws_interact');

// Load external packages
const OSTBase = require('@openstfoundation/openst-base');

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

  SigIntHandler.call(oThis, { id: program.processLockId });
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
    if (!program.processLockId || !program.groupId || !program.prefetchCount) {
      program.help();
      process.exit(1);
    }
  },

  /**
   * warmUpGethPool
   *
   */
  warmUpGethPool: function() {
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
   * Start subscription
   *
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
   * This method executes the promises.
   *
   * @private
   */
  _promiseExecutor: function(onResolve, onReject, params) {
    unAckCount++;

    // Trying because of JSON.parse.
    try {
      // Process request
      const parsedParams = JSON.parse(params),
        payload = parsedParams.message.payload;

      let BlockScannerKlass = ic.getBlockScannerKlass(),
        blockScannerObj = new BlockScannerKlass({
          block_number: payload.blockNumber,
          geth_array: payload.gethArray,
          transaction_hashes: payload.transactionHashes,
          time_stamp: payload.timestamp,
          benchmark_file_path: program.benchmarkFilePath,
          web3_factory_obj: web3InteractFactory,
          delegator_timestamp: payload.delegatorTimestamp,
          process_id: program.processLockId
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
        logger.error('e_rmqs_bs_2', 'Listener could not process blockscanner.. Catch. unAckCount -> ', unAckCount);
      }
    } catch (error) {
      unAckCount--;
      logger.error(
        'e_rmqs_bs_3',
        'Error in parsing the message. unAckCount ->',
        unAckCount,
        'Error: ',
        error,
        'Params: ',
        params
      );
      // ack RMQ
      return onResolve();
    }
  },

  /**
   * This function checks if there are any pending tasks left or not.
   *
   * @returns {boolean}
   */
  pendingTasksDone: function() {
    const oThis = this;

    if (unAckCount !== oThis.PromiseQueueManager.getPendingCount()) {
      logger.error('ERROR :: unAckCount and pending counts are not in sync.');
    }
    return !oThis.PromiseQueueManager.getPendingCount() && !unAckCount;
  }
};

Object.assign(BlockScanner.prototype, BlockScannerPrototype);

let blockScanner = new BlockScanner();
blockScanner.perform().catch(function(err) {
  logger.error(err);
});
