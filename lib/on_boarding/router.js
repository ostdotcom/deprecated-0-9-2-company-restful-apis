"use strict";

const openSTNotification = require('@openstfoundation/openst-notification')
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , notificationTopics = require(rootPrefix + '/lib/global_constant/notification_topics')
  , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , StakeAndMintRouter = require(rootPrefix + '/lib/stake_and_mint/router')
  , AllocateAirdropRouter = require(rootPrefix + '/lib/allocate_airdrop/router')
;

const OnBoardingRouterKlass = function (params) {
  const oThis = this
  ;

  oThis.currentStep = params.current_step;
  oThis.status = params.status;

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
   * @return {promise<result>}
   */
  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("l_ob_r_1", "Unhandled result", null, {}, {});
        }
      });
  },

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function () {
    const oThis = this
    ;

    if(oThis.currentStep === 'init') {
      return oThis.init();
    }

    if((oThis.currentStep === 'propose') && oThis.status === 'done') {
      await oThis.queueDeployAirdrop();
      await oThis.queueStakeAndMint();

      return Promise.resolve();
    }

    if((oThis.currentStep === 'deploy_airdrop') && oThis.status === 'done') {
      await oThis.queueSetWorkers();
      await oThis.queueSetPriceOracle();
      await oThis.queueSetAcceptedMargin();

      return Promise.resolve();
    }

    if(['set_workers', 'set_price_oracle', 'set_accepted_margin'].includes(oThis.currentStep)
      && oThis.status === 'done') {
      return oThis.queueAllocateAirdrop();
    }

  },

  /**
   * Init
   *
   * @return {promise<result>}
   */
  init: async function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
      criticalChainInteractionLogConst.proposeBtActivityType]
    ;

    const clientBrandedTokenRecords = await new ClientBrandedTokenModel().select('id').where(['symbol=?', oThis.tokenSymbol]).fire();
    const clientBrandedToken = clientBrandedTokenRecords[0];

    if(!clientBrandedToken){
     return Promise.reject(responseHelper.error('l_ob_r_2', 'no client branded token found for symbol'+oThis.tokenSymbol, null,
       {}, {sendErrorEmail: false}));
    }

    oThis.clientBrandedTokenId = clientBrandedToken.id;

    const requestParams = {
      client_id: oThis.clientId,
      token_symbol: oThis.tokenSymbol,
      stake_and_mint_params: oThis.stakeAndMintParams,
      airdrop_params: oThis.airdropParams
    };

    const queueBackgroundJobResponse = await oThis.queueBackgroundJob(activityType, notificationTopics.onBoardingPropose, requestParams);
    if(queueBackgroundJobResponse.isFailure()) return queueBackgroundJobResponse;

    oThis.parentCriticalInteractionLogId = queueBackgroundJobResponse.data.critical_chain_interaction_log_id;

    return Promise.resolve(queueBackgroundJobResponse);

  },

  /**
   * Queue Deploy Airdrop
   *
   * @return {promise<result>}
   */
  queueDeployAirdrop: function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
      criticalChainInteractionLogConst.deployAirdropActivityType]
    ;

    return oThis.queueBackgroundJob(activityType, notificationTopics.onBoardingDeployAirdrop);
  },

  /**
   * Queue Stake and Mint
   *
   * @return {promise<result>}
   */
  queueStakeAndMint: function () {
    const oThis = this
    ;

    return new StakeAndMintRouter({
      current_step: 'init',
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
   * @return {promise<result>}
   */
  queueSetWorkers: function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
      criticalChainInteractionLogConst.setWorkerActivityType]
    ;

    return oThis.queueBackgroundJob(activityType, notificationTopics.onBoardingSetWorkers);
  },

  /**
   * Queue Set Price Oracle
   *
   * @return {promise<result>}
   */
  queueSetPriceOracle: function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.setPriceOracleActivityType]
    ;

    return oThis.queueBackgroundJob(activityType, notificationTopics.onBoardingSetPriceOracle);
  },

  /**
   * Queue Set Accepted Margin
   *
   * @return {promise<result>}
   */
  queueSetAcceptedMargin: function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.setAcceptedMarginActivityType]
    ;

    return oThis.queueBackgroundJob(activityType, notificationTopics.onBoardingSetAcceptedMargin);
  },

  /**
   * Queue Allocate Airdrop
   *
   * @return {promise<result>}
   */
  queueAllocateAirdrop: function () {
    const oThis = this
    ;

    return new AllocateAirdropRouter({
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
   * @return {promise<result>}
   */
  queueBackgroundJob: async function (activityType, topic, requestParams) {
    const oThis = this
      , chainType = new CriticalChainInteractionLogModel().invertedChainTypes[criticalChainInteractionLogConst.utilityChainType]
      , status = new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.queuedStatus]
    ;

    const createParams = {
      parent_id: oThis.parentCriticalInteractionLogId,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      client_branded_token_id: oThis.clientBrandedTokenId,
      activity_type: activityType,
      chain_type: chainType,
      status: status,
      request_params: requestParams || {}
    };

    const dbRecord = await new CriticalChainInteractionLogModel().insertRecord(createParams);

    openSTNotification.publishEvent.perform(
      {
        topics: [topic],
        publisher: 'OST',
        message: {
          kind: 'background_job',
          payload: {
            parent_critical_interaction_log_id: oThis.parentCriticalInteractionLogId,
            critical_interaction_log_id: dbRecord.insertId
          }
        }
      }
    );

    return Promise.resolve(responseHelper.successWithData({critical_chain_interaction_log_id: dbRecord.insertId}));

  }

};

module.exports = OnBoardingRouterKlass;