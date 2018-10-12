'use strict';
/**
 * This is factory for all RabbitMQ subscribers.
 *
 * Usage: node executables/rmq_subscribers/factory.js processLockId queueSuffix topicsToSubscribe
 *
 * Command Line Parameters Description:
 * processLockId: processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.
 * queueSuffix: queueSuffix is the suffix to be used for getting the queue name.
 * topicsToSubscribe: topicsToSubscribe is a JSON stringified version of topics to be subscribed for this RMQ subscriber.
 *
 * Example: node executables/rmq_subscribers/factory.js 1 'rmq_subscribers_factory_1' '["on_boarding.#","airdrop_allocate_tokens"]'
 *
 * @module executables/rmq_subscribers/factory
 */
const rootPrefix = '../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

// Load external packages
const OSTBase = require('@openstfoundation/openst-base');

const ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  notificationTopics = require(rootPrefix + '/lib/global_constant/notification_topics'),
  IntercomStatusKlass = require(rootPrefix + '/lib/stake_and_mint/intercomm_status.js');

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/rmq_subscribers/factory.js processLockId queueSuffix topicsToSubscribe');
  logger.log(
    '* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.'
  );
  logger.log('* queueSuffix is the suffix to be used for getting the queue name.');
  logger.log('* topicsToSubscribe is a JSON stringified version of topics to be subscribed for this RMQ subscriber.');
};

const ProcessLocker = new ProcessLockerKlass(),
  args = process.argv,
  processLockId = args[2],
  queueSuffix = args[3],
  topicsToSubscribe = args[4];

let topicsToSubscribeArray = null;

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!processLockId) {
    logger.error('Process Lock id NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!queueSuffix) {
    logger.error('Queue suffix NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!topicsToSubscribe) {
    logger.error('Topics to subscribe NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  try {
    topicsToSubscribeArray = JSON.parse(topicsToSubscribe);
  } catch (err) {
    logger.error('Topics to subscribe passed in INVALID format.');
    logger.error(err);
    usageDemo();
    process.exit(1);
  }

  if (topicsToSubscribeArray.length === 0) {
    logger.error('Topics to subscribe should have at least one topic.');
    usageDemo();
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

ProcessLocker.canStartProcess({ process_title: 'executables_rmq_subscribers_factory' + processLockId });

const queueName = 'executables_rmq_subscribers_factory_' + queueSuffix;

require(rootPrefix + '/lib/on_boarding/propose.js');
require(rootPrefix + '/lib/on_boarding/deploy_airdrop.js');
require(rootPrefix + '/lib/on_boarding/set_workers.js');
require(rootPrefix + '/lib/on_boarding/set_price_oracle.js');
require(rootPrefix + '/lib/on_boarding/set_accepted_margin.js');
require(rootPrefix + '/lib/allocate_airdrop/start_airdrop.js');
require(rootPrefix + '/lib/stake_and_mint/verify_transfer_to_staker.js');
require(rootPrefix + '/lib/stake_and_mint/approve.js');
require(rootPrefix + '/lib/stake_and_mint/start/st_prime.js');
require(rootPrefix + '/lib/stake_and_mint/start/branded_token.js');
require(rootPrefix + '/lib/airdrop_management/distribute_tokens/user_airdrop_contract_approve');
require(rootPrefix + '/lib/transactions/stPrime_transfer');

const icDrivenTopicPerformers = {};

icDrivenTopicPerformers[notificationTopics.onBoardingDeployAirdrop] = 'getSetupAirdropContractClass';
icDrivenTopicPerformers[notificationTopics.onBoardingPropose] = 'getProposeKlass';
icDrivenTopicPerformers[notificationTopics.onBoardingSetWorkers] = 'getSetWorkersClass';
icDrivenTopicPerformers[notificationTopics.onBoardingSetPriceOracle] = 'getSetPriceOracleClass';
icDrivenTopicPerformers[notificationTopics.onBoardingSetAcceptedMargin] = 'getSetAcceptedMarginClass';

icDrivenTopicPerformers[notificationTopics.stakeAndMintInitTransfer] = 'getVerifyTransferToStakerKlass';
icDrivenTopicPerformers[notificationTopics.stakeAndMintApprove] = 'getApproveKlass';
icDrivenTopicPerformers[notificationTopics.stakeAndMintForSTPrime] = 'getStPrimeStartMintKlass';
icDrivenTopicPerformers[notificationTopics.stakeAndMintForBT] = 'getBrandedTokenStartMintKlass';

icDrivenTopicPerformers[notificationTopics.airdrop_approve_contract] = 'getUserAirdropContractApproveClass';
icDrivenTopicPerformers[notificationTopics.airdropAllocateTokens] = 'getStartAllocateAirdropClass';
icDrivenTopicPerformers[notificationTopics.stpTransfer] = 'getTransferSTPrimeClass';

let nonIcDrivenPerformers = {};

nonIcDrivenPerformers[notificationTopics.processStakingOnVcStart] = IntercomStatusKlass;
nonIcDrivenPerformers[notificationTopics.processStakingOnVcDone] = IntercomStatusKlass;
nonIcDrivenPerformers[notificationTopics.processMintingOnUcStart] = IntercomStatusKlass;
nonIcDrivenPerformers[notificationTopics.processMintingOnUcDone] = IntercomStatusKlass;
nonIcDrivenPerformers[notificationTopics.claimTokenOnUcStart] = IntercomStatusKlass;
nonIcDrivenPerformers[notificationTopics.claimTokenOnUcDone] = IntercomStatusKlass;

const InstanceComposer = require(rootPrefix + '/instance_composer'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_client_id');

const promiseExecutor = function(onResolve, onReject, params) {
  // factory logic for deciding what action to perform here.
  const parsedParams = JSON.parse(params),
    topics = parsedParams.topics;

  // Only one topic is supported here. Neglecting the unsupported cases.
  if (topics.length !== 1) return Promise.resolve();

  let topic = topics[0];

  if (nonIcDrivenPerformers.hasOwnProperty(topic)) {
    let PerformerKlass = nonIcDrivenPerformers[topic];

    return new PerformerKlass(parsedParams.message.payload)
      .perform()
      .then(onResolve)
      .catch(function(error) {
        logger.error('error in processor', error);
        return onResolve();
      });
  } else if (icDrivenTopicPerformers.hasOwnProperty(topic)) {
    let configStrategyHelper = new ConfigStrategyHelperKlass(parsedParams.message.payload.client_id);

    configStrategyHelper.get().then(function(configStrategyRsp) {
      if (configStrategyRsp.isFailure()) {
        return onReject(configStrategyRsp);
      }

      let instanceComposer = new InstanceComposer(configStrategyRsp.data);

      let getterMethod = instanceComposer[icDrivenTopicPerformers[topic]];
      let PerformerKlass = getterMethod.apply(instanceComposer);

      if (!PerformerKlass) {
        return onReject(`no performer Klass Found for ${icDrivenTopicPerformers[topic]}`);
      }

      return new PerformerKlass(parsedParams.message.payload)
        .perform()
        .then(onResolve)
        .catch(function(error) {
          logger.error('error in processor', error);
          return onResolve();
        });
    });
  } else {
    return onReject(`no performer Klass Found for ${topic}`);
  }
};

const PromiseQueueManager = new OSTBase.OSTPromise.QueueManager(promiseExecutor, {
  name: 'executables_rmq_subscribers_factory',
  timeoutInMilliSecs: -1
});

const openStNotification = SharedRabbitMqProvider.getInstance();

openStNotification.subscribeEvent.rabbit(
  topicsToSubscribeArray,
  {
    queue: queueName,
    ackRequired: 1,
    prefetch: 25
  },
  function(params) {
    // Promise is required to be returned to manually ack messages in RMQ
    return PromiseQueueManager.createPromise(params);
  }
);

// Using a single function to handle multiple signals
function handle() {
  logger.info('Received Signal');

  if (!PromiseQueueManager.getPendingCount()) {
    logger.log('SIGINT/SIGTERM handle :: No pending Promises.');
    process.exit(1);
  }

  const checkForUnAckTasks = function() {
    if (PromiseQueueManager.getPendingCount() <= 0) {
      logger.log('SIGINT/SIGTERM handle :: No pending Promises.');
      process.exit(1);
    } else {
      logger.info('waiting for open tasks to be done.');
      setTimeout(checkForUnAckTasks, 1000);
    }
  };

  setTimeout(checkForUnAckTasks, 1000);
}

// Handling graceful process exit on getting SIGINT, SIGTERM.
// Once signal found programme will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);
