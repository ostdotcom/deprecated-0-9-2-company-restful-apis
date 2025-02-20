'use strict';
/**
 * This is script to start airdrop for a client token by subscribing to RMQ events.
 *
 * Usage: node executables/rmq_subscribers/start_airdrop.js processLockId
 *
 * Command Line Parameters Description:
 * processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.
 *
 * Example: node executables/rmq_subscribers/start_airdrop.js 1
 *
 * @module executables/rmq_subscribers/start_airdrop
 */

const rootPrefix = '../..';

// Always include module overrides first.
require(rootPrefix + '/module_overrides/index');

// Include Cron Process Handler.
const InstanceComposer = require(rootPrefix + '/instance_composer'),
  notifier = require(rootPrefix + '/helpers/notifier'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  CronProcessesHandler = require(rootPrefix + '/lib/cron_processes_handler'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes'),
  ConnectionTimeoutConst = require(rootPrefix + '/lib/global_constant/connection_timeout'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_client_id'),
  CronProcessHandlerObject = new CronProcessesHandler();

const usageDemo = function() {
  logger.log('Usage:', 'node ./executables/rmq_subscribers/factory.js processLockId');
  logger.log(
    '* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.'
  );
};

// Declare variables.
const args = process.argv,
  processLockId = args[2],
  cronKind = CronProcessesConstants.startAirdrop;

let unAckCount = 0;

// Validate if processLockId was passed or not.
if (!processLockId) {
  logger.error('Process Lock id NOT passed in the arguments.');
  usageDemo();
  process.exit(1);
}

// Check whether the cron can be started or not.
CronProcessHandlerObject.canStartProcess({
  id: +processLockId, // Implicit string to int conversion.
  cron_kind: cronKind
});

require(rootPrefix + '/lib/airdrop_management/distribute_tokens/start');

const subscribeAirdrop = async function() {
  const openStNotification = await SharedRabbitMqProvider.getInstance({
    connectionWaitSeconds: ConnectionTimeoutConst.crons,
    switchConnectionWaitSeconds: ConnectionTimeoutConst.switchConnectionCrons
  });

  openStNotification.subscribeEvent
    .rabbit(
      ['airdrop.start.#'],
      {
        queue: 'start_airdrop_from_restful_apis',
        ackRequired: 1,
        prefetch: 5
      },
      function(params) {
        // Promise is required to be returned to manually ack messages in RMQ
        return new Promise(async function(onResolve, onReject) {
          unAckCount++;
          // Process request
          const parsedParams = JSON.parse(params);
          logger.step('Consumed airdrop start params -> ', parsedParams);

          const payload = parsedParams.message.payload,
            clientAirdropId = payload.client_airdrop_id,
            criticalInteractionLogId = payload.critical_chain_interaction_log_id,
            userIds = payload.user_ids;

          let configStrategyHelper = new ConfigStrategyHelperKlass(payload.client_id);
          configStrategyHelper.get().then(function(configStrategyRsp) {
            let ic = new InstanceComposer(configStrategyRsp.data),
              startAirdropKlass = ic.getDistributeTokensStartClass(),
              startAirdrop = new startAirdropKlass({
                client_airdrop_id: clientAirdropId,
                critical_chain_interaction_log_id: criticalInteractionLogId,
                user_ids: userIds
              });

            startAirdrop
              .perform()
              .then(function(response) {
                if (!response.isSuccess()) {
                  notifier.notify('e_rmqs_sa_1', 'Something went wrong in airdrop distribution', response, params);
                }
                unAckCount--;
                // ack RMQ
                return onResolve();
              })
              .catch(function(err) {
                notifier.notify('e_rmqs_sa_2', 'Something went wrong in airdrop distribution', err, params);

                unAckCount--;
                // ack RMQ
                return onResolve();
              });
          });
        });
      }
    )
    .catch(function(err) {
      logger.error('Error in subscription. ', err);
      ostRmqError(err);
    });
};

// Using a single function to handle multiple signals.
function handle() {
  logger.info('Received Signal');
  const signalHandler = function() {
    if (unAckCount <= 0) {
      logger.info(':: No pending promises. Changing the status ');
      CronProcessHandlerObject.stopProcess(processLockId).then(function() {
        logger.info('Status and last_end_time updated in table. Killing process.');

        // Stop the process only after the entry has been updated in the table.
        process.exit(1);
      });
    } else {
      logger.info('waiting for open tasks to be done.');
      setTimeout(signalHandler, 1000);
    }
  };

  setTimeout(signalHandler, 1000);
}

function ostRmqError(err) {
  logger.info('ostRmqError occurred.', err);
  process.emit('SIGINT');
}

// Handling graceful process exit on getting SIGINT, SIGTERM.
// Once signal found programme will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);
process.on('ost_rmq_error', ostRmqError);

subscribeAirdrop();
