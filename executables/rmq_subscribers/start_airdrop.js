'use strict';
/**
 * This is script to start airdrop for a client token by subscribing to RMQ events.
 *
 * Usage: node executables/rmq_subscribers/start_airdrop.js
 *
 * @module executables/rmq_subscribers/start_airdrop
 */

const rootPrefix = '../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

// Include Process Locker File
const ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  ProcessLocker = new ProcessLockerKlass();

ProcessLocker.canStartProcess({ process_title: 'executables_rmq_subscribers_start_airdrop' });
//ProcessLocker.endAfterTime({time_in_minutes: 60});

// All Module Requires.
const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  notifier = require(rootPrefix + '/helpers/notifier'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_client_id');

require(rootPrefix + '/lib/airdrop_management/distribute_tokens/start');

// Declare variables.
let unAckCount = 0;

const subscribeAirdrop = async function() {
  const openStNotification = await SharedRabbitMqProvider.getInstance();

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
  let f = function() {
    if (unAckCount <= 0) {
      process.exit(1);
    } else {
      logger.info('waiting for open tasks to be done.');
      setTimeout(f, 1000);
    }
  };

  setTimeout(f, 1000);
}

function ostRmqError(err) {
  logger.info('ostRmqError occured.', err);
  process.emit('SIGINT');
}

// Handling graceful process exit on getting SIGINT, SIGTERM.
// Once signal found programme will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);
process.on('ost_rmq_error', ostRmqError);

subscribeAirdrop();
