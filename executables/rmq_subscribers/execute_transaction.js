'use strict';

/**
 * This script will execute transactions by subscribing to RMQ events.
 *
 * Usage: node executables/rmq_subscribers/execute_transaction.js processId
 *
 * Command Line Parameters Description:
 * processId: process id to start the process
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
  processId = args[2];

// Declare variables.
let unAckCount = 0,
  processDetails = null;

ProcessLocker.canStartProcess({
  process_title: 'executables_rmq_subscribers_execute_transaction' + processId
});
ProcessLocker.endAfterTime({ time_in_minutes: 30 });

// Load external packages
const openSTNotification = require('@openstfoundation/openst-notification'),
  OSTBase = require('@openstfoundation/openst-base');

// All Module Requires.
const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_client_id'),
  rmqQueueConstants = require(rootPrefix + '/lib/global_constant/rmq_queue'),
  initProcessKlass = require(rootPrefix + '/lib/execute_transaction_management/init_process'),
  processQueueAssociationConst = require(rootPrefix + '/lib/global_constant/process_queue_association'),
  CommandQueueProcessorKlass = require(rootPrefix + '/lib/execute_transaction_management/command_message_processor'),
  initProcess = new initProcessKlass({ process_id: processId });

require(rootPrefix + '/lib/transactions/transfer_bt');

const promiseTxExecutor = function(onResolve, onReject, params) {
  unAckCount++;
  // Process request
  const parsedParams = JSON.parse(params),
    kind = parsedParams.message.kind,
    payload = parsedParams.message.payload;

  let errorMsgType = '',
    msgExecutorObject = {};

  let configStrategyHelper = new ConfigStrategyHelperKlass(payload.client_id);
  configStrategyHelper.get().then(function(configStrategyRsp) {
    if (configStrategyRsp.isFailure()) {
      return Promise.reject(configStrategyRsp);
    }

    if (kind === rmqQueueConstants.executeTx) {
      errorMsgType = 'transaction';

      let ic = new InstanceComposer(configStrategyRsp.data),
        ExecuteTransferBt = ic.getTransferBtClass();

      msgExecutorObject = new ExecuteTransferBt({
        transactionUuid: payload.transaction_uuid,
        clientId: payload.client_id,
        workerUuid: payload.worker_uuid
      });
    } else {
      errorMsgType = 'command message';
      msgExecutorObject = new CommandQueueProcessorKlass(parsedParams);
    }

    try {
      msgExecutorObject
        .perform()
        .then(function(response) {
          if (!response.isSuccess()) {
            logger.error(
              'e_rmqs_et_1',
              'Something went wrong in ',
              errorMsgType,
              ' execution unAckCount ->',
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
            'Something went wrong in ',
            errorMsgType,
            ' execution. unAckCount ->',
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
      logger.error('Listener could not process ', errorMsgType, '.. Catch. unAckCount -> ', unAckCount);
      return onResolve();
    }
  });
};

const prefetchCount = 100;
const PromiseQueueManager = new OSTBase.OSTPromise.QueueManager(promiseTxExecutor, {
  name: 'execute_tx_promise_queue_manager',
  timeoutInMilliSecs: 3 * 60 * 1000, //3 minutes
  maxZombieCount: Math.round(prefetchCount * 0.25),
  onMaxZombieCountReached: function() {
    logger.warn('w_rmqs_et_1', 'maxZombieCount reached. Triggering SIGTERM.');
    // Trigger graceful shutdown of process.
    process.kill(process.pid, 'SIGTERM');
  }
});
let txQueueSubscribed = false;
let subscribeTxQueue = async function(qNameSuffix) {
  if (!txQueueSubscribed) {
    await openSTNotification.subscribeEvent.rabbit(
      [rmqQueueConstants.executeTxTopicPrefix + qNameSuffix],
      {
        queue: rmqQueueConstants.executeTxQueuePrefix + '_' + qNameSuffix,
        ackRequired: 1,
        prefetch: prefetchCount
      },
      function(params) {
        // Promise is required to be returned to manually ack messages in RMQ
        return PromiseQueueManager.createPromise(params);
      }
    );
    txQueueSubscribed = true;
  }
};

let unAckCommandMessages = 0;
const commandQueueExecutor = function(params) {
  return new Promise(async function(onResolve) {
    let parsedParams = JSON.parse(params);
    let commandQueueProcessor = new CommandQueueProcessorKlass(parsedParams);
    let commandProcessorResponse = await commandQueueProcessor.perform();

    if (
      commandProcessorResponse.data.shouldStartTxQueConsume &&
      commandProcessorResponse.data.shouldStartTxQueConsume === 1
    ) {
      await subscribeTxQueue(processDetails.queue_name_suffix);
    } else if (
      commandProcessorResponse.data.shouldStopTxQueConsume &&
      commandProcessorResponse.data.shouldStopTxQueConsume === 1
    ) {
      process.emit('CANCEL_CONSUME');
      setTimeout(async function() {
        await subscribeCommandQueue(processDetails.queue_name_suffix);
      }, 500);
    }
    unAckCommandMessages--;
    return onResolve();
  });
};

let commandQueueSubscribed = false;
let subscribeCommandQueue = async function(qNameSuffix) {
  if (!commandQueueSubscribed) {
    await openSTNotification.subscribeEvent.rabbit(
      [rmqQueueConstants.commandMessageTopicPrefix + qNameSuffix],
      {
        queue: rmqQueueConstants.commandMessageQueuePrefix + '_' + qNameSuffix,
        ackRequired: 1,
        prefetch: 1
      },
      function(params) {
        unAckCommandMessages++;
        // Promise is required to be returned to manually ack messages in RMQ
        return commandQueueExecutor(params);
      }
    );
    commandQueueSubscribed = true;
  }
};

let init = async function() {
  let initProcessResp = await initProcess.perform();

  processDetails = initProcessResp.processDetails;
  let processStatus = processDetails.status,
    queueSuffix = processDetails.queue_name_suffix;

  if (processStatus === processQueueAssociationConst.processKilled) {
    logger.warn(
      'The process being is in killed status in the table. Recommended to check. Continuing to start the queue.'
    );
  }
  if (initProcessResp.shouldStartTxQueConsume) {
    await subscribeTxQueue(queueSuffix);
  }
  await subscribeCommandQueue(queueSuffix);
};

// Using a single function to handle multiple signals
function handle() {
  logger.info('Received Signal');

  if (!PromiseQueueManager.getPendingCount() && !unAckCount) {
    console.log('SIGINT/SIGTERM handle :: No pending Promises.');
    process.exit(1);
  }

  // The OLD Way - Begin
  let f = function() {
    if (unAckCount !== PromiseQueueManager.getPendingCount()) {
      logger.error('ERROR :: unAckCount and pending counts are not in sync.');
    }
    if ((PromiseQueueManager.getPendingCount() <= 0 || unAckCount <= 0) && unAckCommandMessages === 0) {
      console.log('SIGINT/SIGTERM handle :: No pending Promises.');
      process.exit(1);
    } else {
      logger.info('waiting for open tasks to be done.');
      setTimeout(f, 1000);
    }
  };

  setTimeout(f, 1000);
}

// handling graceful process exit on getting SIGINT, SIGTERM.
// Once signal found programme will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);

init();
