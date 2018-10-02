'use strict';

const rootPrefix = '../..';

const args = process.argv,
  //prefetchCount = args[2],
  group_id = args[2];

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  ProcessLocker = new ProcessLockerKlass();

require(rootPrefix + '/lib/block_scanner/block_scanner');

// Load external packages
const openSTNotification = require('@openstfoundation/openst-notification'),
  OSTBase = require('@openstfoundation/openst-base');

// Check if another process with the same title is running.
ProcessLocker.canStartProcess({ process_title: 'executables_block_scanner_execute_transaction' + group_id });

let unAckCount = 0;

let prefetchCount = 4;

const promiseExecutor = async function(onResolve, onReject, params) {
  const oThis = this;

  unAckCount++;

  // Process request
  const parsedParams = JSON.parse(params);

  const payload = parsedParams.message.payload;

  let strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
    configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(),
    configStrategy = configStrategyResp.data,
    ic = new InstanceComposer(configStrategy);

  let BlockScannerKlass = ic.getBlockScannerKlass(),
    blockScannerObj = new BlockScannerKlass({
      blockNumber: payload.blockNumber,
      provider: payload.provider,
      transactionHashes: payload.transactionHashes
    });

  try {
    // TODO - promise is not returned from BlockScannerKlass, hence response is undefined
    blockScannerObj
      .perform()
      .then(function(response) {
        if (!response.isSuccess()) {
          logger.error(
            'e_bs_ftsabs_1',
            'Something went wrong in blockscanner execution unAckCount ->',
            unAckCount,
            response,
            params
          );
        }
        unAckCount--;
        logger.debug('------ unAckCount -> ', unAckCount);
        // ack RMQ
        return onResolve();
      })
      .catch(function(err) {
        logger.error(
          'e_bs_ftsabs_2',
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
};

const PromiseQueueManager = new OSTBase.OSTPromise.QueueManager(promiseExecutor, {
  name: 'blockscanner_promise_queue_manager',
  timeoutInMilliSecs: 3 * 60 * 1000, //3 minutes
  maxZombieCount: Math.round(prefetchCount * 0.25),
  onMaxZombieCountReached: function() {
    logger.warn('w_e_bs_ftsabs_1', 'maxZombieCount reached. Triggering SIGTERM.');
    // Trigger gracefully shutdown of process.
    process.kill(process.pid, 'SIGTERM');
  }
});

openSTNotification.subscribeEvent.rabbit(
  ['block_scanner_execute_' + group_id],
  {
    queue: 'block_scanner_execute_' + group_id,
    ackRequired: 0,
    prefetch: prefetchCount
  },
  function(params) {
    // Promise is required to be returned to manually ack messages in RMQ
    return PromiseQueueManager.createPromise(params);
  }
);

// Using a single function to handle multiple signals
function handle() {
  logger.info('Received Signal');

  if (!PromiseQueueManager.getPendingCount() && !unAckCount) {
    console.log('SIGINT/SIGTERM handle :: No pending Promises.');
    process.exit(1);
  }

  let f = function() {
    if (unAckCount != PromiseQueueManager.getPendingCount()) {
      logger.error('ERROR :: unAckCount and pending counts are not in sync.');
    }
    if (PromiseQueueManager.getPendingCount() <= 0 || unAckCount <= 0) {
      console.log('SIGINT/SIGTERM handle :: No pending Promises.');
      process.exit(1);
    } else {
      logger.info('waiting for open tasks to be done.');
      setTimeout(f, 1000);
    }
  };

  setTimeout(f, 1000);
}

// handling gracefully process exit on getting SIGINT, SIGTERM.
// Once signal found programme will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);
