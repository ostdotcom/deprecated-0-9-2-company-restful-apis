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

// Always include module overrides first
require(rootPrefix + '/module_overrides/index');

// Include Process Locker File
const ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  ProcessLocker = new ProcessLockerKlass();

const args = process.argv,
  processId = args[2];

// Declare variables.
const txQueuePrefetchCount = 100,
  cmdQueuePrefetchCount = 1;

let unAckCount = 0,
  processDetails = null,
  unAckCommandMessages = 0,
  txQueueSubscribed = false,
  commandQueueSubscribed = false,
  intentToConsumerTagMap = { cmdQueue: null, exTxQueue: null };

// Start process locker.
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
  rmqQueueConstants = require(rootPrefix + '/lib/global_constant/rmq_queue'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_client_id'),
  initProcessKlass = require(rootPrefix + '/lib/execute_transaction_management/init_process'),
  processQueueAssociationConst = require(rootPrefix + '/lib/global_constant/process_queue_association'),
  CommandQueueProcessorKlass = require(rootPrefix + '/lib/execute_transaction_management/command_message_processor'),
  initProcess = new initProcessKlass({ process_id: processId });

require(rootPrefix + '/lib/transactions/transfer_bt');

/**
 *
 * Actions to be taken on the response of command message processor.
 *
 * @param {Object} commandProcessorResponse
 * @returns {Promise<void>}
 */
const commandResponseActions = async function(commandProcessorResponse) {
  if (
    commandProcessorResponse.data.shouldStartTxQueConsume &&
    commandProcessorResponse.data.shouldStartTxQueConsume === 1
  ) {
    await subscribeTxQueue(processDetails.queue_name_suffix, processDetails.chain_id);
  } else if (
    commandProcessorResponse.data.shouldStopTxQueConsume &&
    commandProcessorResponse.data.shouldStopTxQueConsume === 1
  ) {
    process.emit('CANCEL_CONSUME', intentToConsumerTagMap.exTxQueue);
    txQueueSubscribed = false;
  }
};

/**
 *
 * Promise executor for transaction executing queue.
 *
 * @param onResolve
 * @param onReject
 * @param params
 */
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
          } else {
            if (kind !== rmqQueueConstants.executeTx) {
              commandResponseActions(response);
            }
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

/**
 * Promise Queue manager
 */
const PromiseQueueManager = new OSTBase.OSTPromise.QueueManager(promiseTxExecutor, {
  name: 'execute_tx_promise_queue_manager',
  timeoutInMilliSecs: 3 * 60 * 1000, //3 minutes
  maxZombieCount: Math.round(txQueuePrefetchCount * 0.25),
  onMaxZombieCountReached: function() {
    logger.warn('w_rmqs_et_1', 'maxZombieCount reached. Triggering SIGTERM.');
    // Trigger graceful shutdown of process.
    process.kill(process.pid, 'SIGTERM');
  }
});

/**
 * Subscribe to execute_transaction queue.
 * @param qNameSuffix
 * @param chainId
 * @returns {Promise<void>}
 */
const subscribeTxQueue = async function(qNameSuffix, chainId) {
  if (!txQueueSubscribed) {
    if (intentToConsumerTagMap.exTxQueue) {
      process.emit('RESUME_CONSUME', intentToConsumerTagMap.exTxQueue);
    } else {
      await openSTNotification.subscribeEvent.rabbit(
        [rmqQueueConstants.executeTxTopicPrefix + chainId + '.' + qNameSuffix],
        {
          queue: rmqQueueConstants.executeTxQueuePrefix + '_' + chainId + '_' + qNameSuffix,
          ackRequired: 1,
          prefetch: txQueuePrefetchCount
        },
        function(params) {
          // Promise is required to be returned to manually ack messages in RMQ
          return PromiseQueueManager.createPromise(params);
        },
        function(consumerTag) {
          intentToConsumerTagMap.exTxQueue = consumerTag;
        }
      );
    }
    txQueueSubscribed = true;
  }
};

/**
 *
 * Executes command messages by calling command queue processor class.
 *
 * @param {Object} params
 * @returns {Promise<any>}
 */
const commandQueueExecutor = function(params) {
  return new Promise(async function(onResolve) {
    let parsedParams = JSON.parse(params);
    let commandQueueProcessor = new CommandQueueProcessorKlass(parsedParams);
    let commandProcessorResponse = await commandQueueProcessor.perform();

    await commandResponseActions(commandProcessorResponse);
    unAckCommandMessages--;
    return onResolve();
  });
};

/**
 * Subscribe to command_message queue.
 * @param qNameSuffix
 * @param chainId
 * @returns {Promise<void>}
 */
const subscribeCommandQueue = async function(qNameSuffix, chainId) {
  if (!commandQueueSubscribed) {
    await openSTNotification.subscribeEvent.rabbit(
      [rmqQueueConstants.commandMessageTopicPrefix + chainId + '.' + qNameSuffix],
      {
        queue: rmqQueueConstants.commandMessageQueuePrefix + '_' + chainId + '_' + qNameSuffix,
        ackRequired: 1,
        prefetch: cmdQueuePrefetchCount
      },
      function(params) {
        unAckCommandMessages++;
        // Promise is required to be returned to manually ack messages in RMQ
        return commandQueueExecutor(params);
      },
      function(consumerTag) {
        intentToConsumerTagMap.cmdQueue = consumerTag;
      }
    );
    commandQueueSubscribed = true;
  }
};

/**
 *
 * Init process called during start-up of script.
 *
 * @returns {Promise<void>}
 */
let init = async function() {
  let initProcessResp = await initProcess.perform();

  processDetails = initProcessResp.processDetails;
  let processStatus = processDetails.status,
    queueSuffix = processDetails.queue_name_suffix,
    chainId = processDetails.chain_id;

  if (processStatus === processQueueAssociationConst.processKilled) {
    logger.warn(
      'The process being is in killed status in the table. Recommended to check. Continuing to start the queue.'
    );
  }
  if (initProcessResp.shouldStartTxQueConsume) {
    await subscribeTxQueue(queueSuffix, chainId);
  }
  await subscribeCommandQueue(queueSuffix, chainId);
};

/**
 * Signal handler
 */
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

// Handling graceful process exit on getting SIGINT, SIGTERM.
// Once signal found, program will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);

// Call script initializer.
init();
