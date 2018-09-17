'use strict';

/**
 * This script will execute transactions by subscribing to RMQ events.
 *
 * Usage: node executables/rmq_subscribers/execute_transaction.js processId [slowProcessor]
 *
 * Command Line Parameters Description:
 * processId: process id to start the process
 * [slowProcessor]: another queue for slower transactions
 *
 * Example: node executables/rmq_subscribers/execute_transaction.js 1
 *
 * @module executables/rmq_subscribers/execute_transaction
 */

const rootPrefix = '../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

// Include Process Locker File
const ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  ProcessLocker = new ProcessLockerKlass();
const args = process.argv,
  processId = args[2],
  slowProcessor = args[3];

let unAckCount = 0;

ProcessLocker.canStartProcess({
  process_title: 'executables_rmq_subscribers_execute_transaction' + processId + '-' + (slowProcessor || '')
});
//ProcessLocker.endAfterTime({time_in_minutes: 60});

// Load external packages
const openSTNotification = require('@openstfoundation/openst-notification'),
  OSTBase = require('@openstfoundation/openst-base');

//All Module Requires.
const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy'),
  configStrategyHelper = new ConfigStrategyHelperKlass();

require(rootPrefix + '/lib/transactions/transfer_bt');

const promiseExecutor = function(onResolve, onReject, params) {
  unAckCount++;
  // Process request
  const parsedParams = JSON.parse(params);

  const payload = parsedParams.message.payload;

  configStrategyHelper.getConfigStrategy(payload.clientId).then(function(configStrategyRsp) {
    if (configStrategyRsp.isFailure()) {
      return Promise.reject(configStrategyRsp);
    }

    let ic = new InstanceComposer(configStrategyRsp.data),
      ExecuteTransferBt = ic.getTransferBtClass();

    let executeTransactionObj = new ExecuteTransferBt({
      transactionUuid: payload.transactionUuid,
      clientId: payload.clientId,
      rateLimitCount: payload.rateLimitCount
    });

    try {
      executeTransactionObj
        .perform()
        .then(function(response) {
          if (!response.isSuccess()) {
            if (response.toHash().err.msg == 'lifo fire') {
              publishToSlowQueue(parsedParams);
            }
            logger.error(
              'e_rmqs_et_1',
              'Something went wrong in transaction execution unAckCount ->',
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
            'e_rmqs_et_2',
            'Something went wrong in transaction execution. unAckCount ->',
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
      logger.error('Listener could not process transaction.. Catch. unAckCount -> ', unAckCount);
      return onResolve();
    }
  });
};

const publishToSlowQueue = async function(parsedParams) {
  openSTNotification.publishEvent
    .perform({
      topics: ['slow.transaction.execute'],
      publisher: parsedParams.publisher,
      message: parsedParams.message
    })
    .then(logger.debug, logger.error);
};

const prefetchCount = (slowProcessor || '') == 'slow' ? 25 : 100;
const PromiseQueueManager = new OSTBase.OSTPromise.QueueManager(promiseExecutor, {
  name: 'execute_tx_promise_queue_manager',
  timeoutInMilliSecs: 3 * 60 * 1000, //3 minutes
  maxZombieCount: Math.round(prefetchCount * 0.25),
  onMaxZombieCountReached: function() {
    logger.warn('w_rmqs_et_1', 'maxZombieCount reached. Triggring SIGTERM.');
    // Trigger gracefull shutdown of process.
    process.kill(process.pid, 'SIGTERM');
  }
});

const topicPrefix = slowProcessor ? 'slow.' : '';
openSTNotification.subscribeEvent.rabbit(
  [topicPrefix + 'transaction.execute'],
  {
    queue: topicPrefix + 'transaction_execute_from_restful_apis',
    ackRequired: 1,
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

  // The OLD Way - Begin
  var f = function() {
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

// handling gracefull process exit on getting SIGINT, SIGTERM.
// Once signal found programme will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);
