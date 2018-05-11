"use strict";

/**
 * Factory for all rabbitmq subscribers.<br><br>
 *
 * @module executables/rmq_subscribers/factory
 *
 */
const rootPrefix = '../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

// Load external packages
const openSTNotification = require('@openstfoundation/openst-notification')
  , OSTBase = require('@openstfoundation/openst-base')
;

const ProcessLockerKlass = require(rootPrefix + '/lib/process_locker')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , notificationTopics = require(rootPrefix + '/lib/global_constant/notification_topics')
;

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/rmq_subscribers/factory.js processLockId queueSuffix topicsToSubscribe');
  logger.log('* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.');
  logger.log('* queueSuffix is the suffix to be used for getting the queue name.');
  logger.log('* topicsToSubscribe is a JSON stringified version of topics to be subscribed for this RMQ subscriber.');
};

const ProcessLocker = new ProcessLockerKlass()
  , args = process.argv
  , processLockId = args[2]
  , queueSuffix = args[3]
  , topicsToSubscribe = args[4]
;

var topicsToSubscribeArray = null
;

const validateAndSanitize = function () {
  if(!processLockId) {
    logger.error('Process Lock id NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!queueSuffix) {
    logger.error('Queue suffix NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if(!topicsToSubscribe) {
    logger.error('Topics to subscribe NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  try {
    topicsToSubscribeArray = JSON.parse(topicsToSubscribe);
  } catch(err) {
    logger.error('Topics to subscribe passed in INVALID format.');
    logger.error(err);
    usageDemo();
    process.exit(1);
  }

  if (topicsToSubscribeArray.length == 0) {
    logger.error('Topics to subscribe should have at least one topic.');
    usageDemo();
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

const queueName = 'executables_rmq_subscribers_factory_' + queueSuffix;

ProcessLocker.canStartProcess({process_title: 'executables_rmq_subscribers_factory' + processLockId});

const topicPerformers = {};
topicPerformers[notificationTopics.onBoardingPropose] = require(rootPrefix + '/lib/on_boarding/propose.js');
topicPerformers[notificationTopics.onBoardingDeployAirdrop] = require(rootPrefix + '/lib/on_boarding/deploy_airdrop.js');
topicPerformers[notificationTopics.onBoardingSetWorkers] = require(rootPrefix + '/lib/on_boarding/set_workers.js');
topicPerformers[notificationTopics.onBoardingSetPriceOracle] = require(rootPrefix + '/lib/on_boarding/set_price_oracle.js');
topicPerformers[notificationTopics.onBoardingSetAcceptedMargin] = require(rootPrefix + '/lib/on_boarding/set_accepted_margin.js');
topicPerformers[notificationTopics.airdropAllocateTokens] = require(rootPrefix + '/lib/allocate_airdrop/start_airdrop.js');
topicPerformers[notificationTopics.stakeAndMintInitTransfer] = require(rootPrefix + '/lib/stake_and_mint/verify_transfer_to_staker.js');
topicPerformers[notificationTopics.stakeAndMintApprove] = require(rootPrefix + '/lib/stake_and_mint/approve.js');
topicPerformers[notificationTopics.stakeAndMintForSTPrime] = require(rootPrefix + '/lib/stake_and_mint/start/st_prime.js');
topicPerformers[notificationTopics.stakeAndMintForBT] = require(rootPrefix + '/lib/stake_and_mint/start/branded_token.js');
topicPerformers[notificationTopics.processStakingOnVcStart] = require(rootPrefix + '/lib/stake_and_mint/intercomm_status.js');
topicPerformers[notificationTopics.processStakingOnVcDone] = require(rootPrefix + '/lib/stake_and_mint/intercomm_status.js');
topicPerformers[notificationTopics.processMintingOnUcStart] = require(rootPrefix + '/lib/stake_and_mint/intercomm_status.js');
topicPerformers[notificationTopics.processMintingOnUcDone] = require(rootPrefix + '/lib/stake_and_mint/intercomm_status.js');
topicPerformers[notificationTopics.claimTokenOnUcStart] = require(rootPrefix + '/lib/stake_and_mint/intercomm_status.js');
topicPerformers[notificationTopics.claimTokenOnUcDone] = require(rootPrefix + '/lib/stake_and_mint/intercomm_status.js');
topicPerformers[notificationTopics.airdrop_approve_contract] = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/user_airdrop_contract_approve');
topicPerformers[notificationTopics.stpTransfer] = require(rootPrefix + '/lib/transactions/stPrime_transfer');

const promiseExecutor = function (onResolve, onReject, params ) {
  // factory logic for deciding what action to perform here.
  const parsedParams = JSON.parse(params)
    , topics = parsedParams.topics
  ;

  // Only one topic is supported here. Neglecting the unsupported cases.
  if(topics.length != 1) return Promise.resolve();

  const topic = topics[0]
    , PerformerKlass = topicPerformers[topic]
  ;

  if(!PerformerKlass) return Promise.resolve;

  logger.log('topic', topic);
  logger.log('parsedParams.message.payload', parsedParams.message.payload);

  return new PerformerKlass(parsedParams.message.payload).perform()
      .then(onResolve)
      .catch(function(error) {
        logger.error('error in processor', error);
        return onResolve();
      });

};

const PromiseQueueManager = new OSTBase.OSTPromise.QueueManager(
  promiseExecutor,
  {
    name: "executables_rmq_subscribers_factory",
    timeoutInMilliSecs: -1
  }
);

openSTNotification.subscribeEvent.rabbit(
  topicsToSubscribeArray,
  {
    queue: queueName,
    ackRequired: 1,
    prefetch: 25
  },
  function (params) {
    // Promise is required to be returned to manually ack messages in RMQ
    return PromiseQueueManager.createPromise( params );
  }
);

// Using a single function to handle multiple signals
function handle() {
  logger.info('Received Signal');

  if (!PromiseQueueManager.getPendingCount()) {
    logger.log("SIGINT/SIGTERM handle :: No pending Promises.");
    process.exit( 0 );
  }

  const checkForUnAckTasks = function(){
    if ( PromiseQueueManager.getPendingCount() <= 0) {
      logger.log("SIGINT/SIGTERM handle :: No pending Promises.");
      process.exit( 0 );
    } else {
      logger.info('waiting for open tasks to be done.');
      setTimeout(checkForUnAckTasks, 1000);
    }
  };

  setTimeout(checkForUnAckTasks, 1000);
}

// handling gracefull process exit on getting SIGINT, SIGTERM.
// Once signal found programme will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);