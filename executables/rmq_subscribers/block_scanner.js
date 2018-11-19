'use strict';
/**
 * This code acts as a worker process for block scanner, which takes the transactions from delegator
 * and processes it using block scanner class. [ lib/block_scanner/for_tx_status_and_balance_sync.js ]
 *
 * Usage: node executables/rmq_subscribers/block_scanner.js 1
 *
 * Command Line Parameters Description:
 * processLockId: used for ensuring that no other process with the same processLockId can run on a given machine.
 *
 * @module executables/rmq_subscribers/block_scanner
 */

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  CronProcessesHandler = require(rootPrefix + '/lib/cron_processes_handler'),
  web3InteractFactory = require(rootPrefix + '/lib/web3/interact/ws_interact'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes'),
  CronProcessHandlerObject = new CronProcessesHandler();

const usageDemo = function() {
  logger.log('Usage:', 'node executables/rmq_subscribers/block_scanner.js processLockId');
  logger.log(
    '* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.'
  );
};

// Declare variables.
const args = process.argv,
  processLockId = args[2],
  cronKind = CronProcessesConstants.blockScannerWorker;

let ic = null,
  unAckCount = 0,
  groupId,
  prefetchCount,
  benchmarkFilePath;

// Validate if processLockId was passed or not.
if (!processLockId) {
  logger.error('Process Lock id NOT passed in the arguments.');
  usageDemo();
  process.exit(1);
}

require(rootPrefix + '/lib/web3/interact/ws_interact');
require(rootPrefix + '/lib/block_scanner/for_tx_status_and_balance_sync');

// Load external packages
const OSTBase = require('@openstfoundation/openst-base');

const BlockScanner = function() {
  const oThis = this;

  oThis.stopPickingUpNewWork = false;

  oThis.PromiseQueueManager = new OSTBase.OSTPromise.QueueManager(oThis._promiseExecutor, {
    name: 'blockscanner_promise_queue_manager',
    timeoutInMilliSecs: 3 * 60 * 1000, //3 minutes
    maxZombieCount: Math.round(prefetchCount * 0.25),
    onMaxZombieCountReached: function() {
      logger.warn('e_rmqs_bs_2', 'maxZombieCount reached. Triggering SIGTERM.');
      // Trigger gracefully shutdown of process.
      process.kill(process.pid, 'SIGTERM');
    }
  });

  SigIntHandler.call(oThis, { id: processLockId });
};

BlockScanner.prototype = Object.create(SigIntHandler.prototype);

const BlockScannerPrototype = {
  perform: async function() {
    const oThis = this;

    oThis._validateAndSanitize();

    await oThis.warmUpGethPool();

    oThis.startSubscription();
  },

  /**
   * Validates the params.
   *
   * @private
   */
  _validateAndSanitize: function() {
    if (!groupId) {
      logger.error('Group Id NOT available in cron params in the database.');
      process.emit('SIGINT');
    }

    if (!prefetchCount) {
      logger.error('Prefetch count NOT available in cron params in the database.');
      process.emit('SIGINT');
    }
  },

  /**
   * Warms up the geth pool.
   *
   * @returns {Promise<any>}
   */
  warmUpGethPool: function() {
    return new Promise(async function(onResolve, onReject) {
      let utilityGethType = 'read_only',
        strategyByGroupHelperObj = new StrategyByGroupHelper(groupId),
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
   * Start subscription.
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
        prefetch: prefetchCount
      },
      function(params) {
        // Promise is required to be returned to manually ack messages in RMQ
        return oThis.PromiseQueueManager.createPromise(params);
      },
      function(consumerTag) {
        oThis.consumerTag = consumerTag;
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
          benchmark_file_path: benchmarkFilePath,
          web3_factory_obj: web3InteractFactory,
          delegator_timestamp: payload.delegatorTimestamp,
          process_id: processLockId
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

// Check whether the cron can be started or not.
CronProcessHandlerObject.canStartProcess({
  id: +processLockId, // Implicit string to int conversion.
  cron_kind: cronKind
}).then(function(dbResponse) {
  let cronParams;

  try {
    cronParams = JSON.parse(dbResponse.data.params);

    groupId = cronParams.group_id;
    prefetchCount = +cronParams.prefetch_count;
    benchmarkFilePath = cronParams.benchmark_file_path
      ? coreConstants.APP_SHARED_DIRECTORY + cronParams.benchmark_file_path
      : null;

    const blockScanner = new BlockScanner();
    blockScanner.perform().catch(function(err) {
      logger.error(err);
    });
  } catch (err) {
    logger.error('cronParams stored in INVALID format in the DB.');
    logger.error(
      'The status of the cron was NOT changed to stopped. Please check the status before restarting the cron'
    );
    process.exit(1);
  }
});

CronProcessHandlerObject.endAfterTime({ time_in_minutes: 45 });
