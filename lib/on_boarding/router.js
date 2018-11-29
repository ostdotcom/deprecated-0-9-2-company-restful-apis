'use strict';

const rootPrefix = '../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  StakeAndMintRouter = require(rootPrefix + '/lib/stake_and_mint/router'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  AllocateAirdropRouter = require(rootPrefix + '/lib/allocate_airdrop/router'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  notificationTopics = require(rootPrefix + '/lib/global_constant/notification_topics'),
  ConnectionTimeoutConst = require(rootPrefix + '/lib/global_constant/connection_timeout'),
  CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log'),
  criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

const OnBoardingRouterKlass = function(params) {
  const oThis = this;

  oThis.currentStep = params.current_step;
  oThis.status = params.status;

  oThis.utilityChainId = params.utility_chain_id;
  oThis.valueChainId = params.value_chain_id;
  oThis.tokenSymbol = params.token_symbol;
  oThis.clientId = params.client_id;
  oThis.clientTokenId = params.client_token_id;
  oThis.parentCriticalInteractionLogId = params.parent_critical_interaction_log_id;
  oThis.clientBrandedTokenId = params.client_branded_token_id;

  oThis.stakeAndMintParams = params.stake_and_mint_params;
  oThis.airdropParams = params.airdrop_params;
};

OnBoardingRouterKlass.prototype = {
  /**
   * Perform
   *
   * @return {Promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error(`${__filename}::perform::catch`);
      logger.error(error);

      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        return responseHelper.error({
          internal_error_identifier: 'l_ob_r_1',
          api_error_identifier: 'unhandled_catch_response',
          error_config: errorConfig
        });
      }
    });
  },

  /**
   * Async Perform
   *
   * @return {Promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this;

    if (oThis.currentStep === 'init') {
      return oThis.init();
    }

    if (oThis.currentStep === 'propose' && oThis.status === 'done') {
      await oThis.queueDeployAirdrop();
      await oThis.queueStakeAndMint();

      return Promise.resolve(responseHelper.successWithData({}));
    }

    if (oThis.currentStep === 'deploy_airdrop' && oThis.status === 'done') {
      await oThis.queueSetWorkers();
      await oThis.queueSetPriceOracle();
      await oThis.queueSetAcceptedMargin();

      return Promise.resolve(responseHelper.successWithData({}));
    }

    if (
      ['set_workers', 'set_price_oracle', 'set_accepted_margin'].includes(oThis.currentStep) &&
      oThis.status === 'done'
    ) {
      return oThis.queueAllocateAirdrop();
    }
  },

  /**
   * Init
   *
   * @return {Promise<result>}
   */
  init: async function() {
    const oThis = this,
      activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.proposeBtActivityType
      ];

    const clientBrandedTokenRecords = await new ClientBrandedTokenModel()
      .select('id')
      .where(['symbol=?', oThis.tokenSymbol])
      .fire();
    const clientBrandedToken = clientBrandedTokenRecords[0];

    if (!clientBrandedToken) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_r_2',
          api_error_identifier: 'client_branded_token_not_found',
          debug_options: { tokenSymbol: oThis.tokenSymbol },
          error_config: errorConfig
        })
      );
    }

    oThis.clientBrandedTokenId = clientBrandedToken.id;

    const requestParams = {
      client_id: oThis.clientId,
      token_symbol: oThis.tokenSymbol,
      stake_and_mint_params: oThis.stakeAndMintParams,
      airdrop_params: oThis.airdropParams
    };

    const queueBackgroundJobResponse = await oThis.queueBackgroundJob(
      activityType,
      notificationTopics.onBoardingPropose,
      requestParams
    );
    if (queueBackgroundJobResponse.isFailure()) return queueBackgroundJobResponse;

    oThis.parentCriticalInteractionLogId = queueBackgroundJobResponse.data.critical_chain_interaction_log_id;

    return Promise.resolve(queueBackgroundJobResponse);
  },

  /**
   * Queue Deploy Airdrop
   *
   * @return {Promise<result>}
   */
  queueDeployAirdrop: function() {
    const oThis = this,
      activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.deployAirdropActivityType
      ];

    return oThis.queueBackgroundJob(activityType, notificationTopics.onBoardingDeployAirdrop);
  },

  /**
   * Queue Stake and Mint
   *
   * @return {Promise<result>}
   */
  queueStakeAndMint: function() {
    const oThis = this;

    return new StakeAndMintRouter({
      current_step: 'init',
      utility_chain_id: oThis.utilityChainId,
      value_chain_id: oThis.valueChainId,
      token_symbol: oThis.tokenSymbol,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      parent_critical_interaction_log_id: oThis.parentCriticalInteractionLogId,
      client_branded_token_id: oThis.clientBrandedTokenId
    }).init();
  },

  /**
   * Queue Set Workers
   *
   * @return {Promise<result>}
   */
  queueSetWorkers: function() {
    const oThis = this,
      activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.setWorkerActivityType
      ];

    return oThis.queueBackgroundJob(activityType, notificationTopics.onBoardingSetWorkers);
  },

  /**
   * Queue Set Price Oracle
   *
   * @return {Promise<result>}
   */
  queueSetPriceOracle: function() {
    const oThis = this,
      activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.setPriceOracleActivityType
      ];

    return oThis.queueBackgroundJob(activityType, notificationTopics.onBoardingSetPriceOracle);
  },

  /**
   * Queue Set Accepted Margin
   *
   * @return {Promise<result>}
   */
  queueSetAcceptedMargin: function() {
    const oThis = this,
      activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.setAcceptedMarginActivityType
      ];

    return oThis.queueBackgroundJob(activityType, notificationTopics.onBoardingSetAcceptedMargin);
  },

  /**
   * Queue Allocate Airdrop
   *
   * @return {Promise<result>}
   */
  queueAllocateAirdrop: function() {
    const oThis = this;

    return new AllocateAirdropRouter({
      utility_chain_id: oThis.utilityChainId,
      value_chain_id: oThis.valueChainId,
      current_step: 'init',
      token_symbol: oThis.tokenSymbol,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      parent_critical_interaction_log_id: oThis.parentCriticalInteractionLogId,
      client_branded_token_id: oThis.clientBrandedTokenId
    }).init();
  },

  /**
   * Queue Background Job
   *
   * @return {Promise<result>}
   */
  queueBackgroundJob: async function(activityType, topic, requestParams) {
    const oThis = this,
      chainType = new CriticalChainInteractionLogModel().invertedChainTypes[
        criticalChainInteractionLogConst.utilityChainType
      ],
      status = new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.queuedStatus];

    const createParams = {
      chain_id: oThis.utilityChainId,
      parent_id: oThis.parentCriticalInteractionLogId,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      client_branded_token_id: oThis.clientBrandedTokenId,
      activity_type: activityType,
      chain_type: chainType,
      status: status,
      request_params: requestParams || {}
    };

    const dbRecordResponse = await new CriticalChainInteractionLogModel().insertRecord(createParams),
      dbRecord = dbRecordResponse.data.dbRecord,
      payload = {
        parent_critical_interaction_log_id: oThis.parentCriticalInteractionLogId,
        critical_interaction_log_id: dbRecord.insertId,
        client_id: oThis.clientId
      };

    const openStNotification = await SharedRabbitMqProvider.getInstance({
      connectionWaitSeconds: ConnectionTimeoutConst.appServer,
      switchConnectionWaitSeconds: ConnectionTimeoutConst.switchConnectionAppServer
    });

    openStNotification.publishEvent
      .perform({
        topics: [topic],
        publisher: 'OST',
        message: {
          kind: 'background_job',
          payload: payload
        }
      })
      .catch(function(err) {
        logger.error('Message for on-boarding router was not published. Payload: ', payload, ' Error: ', err);
      });

    return Promise.resolve(responseHelper.successWithData({ critical_chain_interaction_log_id: dbRecord.insertId }));
  }
};

module.exports = OnBoardingRouterKlass;
