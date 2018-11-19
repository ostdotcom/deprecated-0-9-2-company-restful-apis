'use strict';
/**
 * This is factory for all RabbitMQ subscribers.
 *
 * Usage: node executables/rmq_subscribers/factory.js processLockId
 *
 * Command Line Parameters Description:
 * processLockId: processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.
 *
 * Example: node executables/rmq_subscribers/factory.js 1
 *
 * @module executables/rmq_subscribers/factory
 */
const rootPrefix = '../..';

// Always include module overrides first.
require(rootPrefix + '/module_overrides/index');

// Load external packages
const OSTBase = require('@openstfoundation/openst-base');

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  CronProcessesHandler = require(rootPrefix + '/lib/cron_processes_handler'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes'),
  notificationTopics = require(rootPrefix + '/lib/global_constant/notification_topics'),
  IntercomStatusKlass = require(rootPrefix + '/lib/stake_and_mint/intercomm_status.js'),
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
  cronKind = CronProcessesConstants.rmqFactory;

let queueName,
  queueSuffix,
  topicsToSubscribe,
  topicsToSubscribeArray = null;

// Validate if processLockId was passed or not.
if (!processLockId) {
  logger.error('Process Lock id NOT passed in the arguments.');
  usageDemo();
  process.exit(1);
}

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

const RmqFactory = function() {
  const oThis = this;

  oThis.PromiseQueueManager = new OSTBase.OSTPromise.QueueManager(oThis._promiseExecutor, {
    name: 'executables_rmq_subscribers_factory',
    timeoutInMilliSecs: -1
  });

  SigIntHandler.call(oThis, { id: processLockId });
};

RmqFactory.prototype = Object.create(SigIntHandler.prototype);

const RmqFactoryPrototype = {
  /**
   * perform
   *
   * @returns {Promise}
   */
  perform: function() {
    const oThis = this;

    // Validate and sanitize the input params.
    oThis._validateAndSanitize();

    oThis.startSubscription();
  },

  /**
   * _validateAndSanitize
   *
   * @private
   */
  _validateAndSanitize: function() {
    if (!queueSuffix) {
      logger.error('Queue suffix NOT available in cron params in the database.');
      process.emit('SIGINT');
    }

    if (!topicsToSubscribe) {
      logger.error('Topics to subscribe NOT available in cron params in the database.');
      process.emit('SIGINT');
    }

    try {
      topicsToSubscribeArray = JSON.parse(topicsToSubscribe);
    } catch (err) {
      logger.error('Topics to subscribe passed in INVALID format from the database..');
      logger.error(err);
      process.emit('SIGINT');
    }

    if (topicsToSubscribeArray.length === 0) {
      logger.error('Topics to subscribe should have at least one topic.');
      usageDemo();
      process.emit('SIGINT');
    }
  },

  /**
   * _promiseExecutor
   *
   * @returns {Promise}
   */
  _promiseExecutor: function(onResolve, onReject, params) {
    // Factory logic for deciding what action to perform here.
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
  },

  /**
   * startSubscription
   *
   */
  startSubscription: function() {
    const oThis = this,
      openStNotification = SharedRabbitMqProvider.getInstance();

    openStNotification.subscribeEvent.rabbit(
      topicsToSubscribeArray,
      {
        queue: queueName,
        ackRequired: 1,
        prefetch: 25
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
   * pendingTasksDone
   *
   * @returns {Boolean}
   */
  pendingTasksDone: function() {
    const oThis = this;

    return oThis.PromiseQueueManager.getPendingCount() <= 0;
  }
};

Object.assign(RmqFactory.prototype, RmqFactoryPrototype);

// Handler for rmq errors.
function ostRmqError(err) {
  logger.info('ostRmqError occurred.', err);
  process.emit('SIGINT');
}

process.on('ost_rmq_error', ostRmqError);

// Check whether the cron can be started or not.
CronProcessHandlerObject.canStartProcess({
  id: +processLockId, // Implicit string to int conversion.
  cron_kind: cronKind
}).then(function(dbResponse) {
  let cronParams;
  const rmqFactory = new RmqFactory();

  try {
    cronParams = JSON.parse(dbResponse.data.params);

    // queueSuffix is the suffix to be used for getting the queue name.
    queueSuffix = cronParams.queue_suffix;
    queueName = 'executables_rmq_subscribers_factory_' + queueSuffix;

    // topicsToSubscribe is a JSON stringified version of topics to be subscribed for this RMQ subscriber.
    topicsToSubscribe = cronParams.topics_to_subscribe;

    rmqFactory.perform();
  } catch (err) {
    logger.error('cronParams stored in INVALID format in the DB.');
    logger.error(
      'The status of the cron was NOT changed to stopped. Please check the status before restarting the cron'
    );
    process.exit(1);
  }
});
