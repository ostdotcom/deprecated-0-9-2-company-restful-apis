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
  , AllocateAirdropRouter = require(rootPrefix + '/lib/allocate_airdrop/router')
;

const StakeAndMintRouterKlass = function (params) {
  const oThis = this
  ;

  oThis.currentStep = params.current_step;
  oThis.status = params.status;

  oThis.tokenSymbol = params.token_symbol;
  oThis.clientId = params.client_id;
  oThis.clientTokenId = params.client_token_id;
  oThis.parentCriticalInteractionLogId = params.parent_critical_interaction_log_id;
  oThis.clientBrandedTokenId = params.client_branded_token_id;
  oThis.parentActivityType = params.parent_activity_type;

  oThis.stakeAndMintParams = params.stake_and_mint_params;
  oThis.airdropParams = params.airdrop_params;

};

StakeAndMintRouterKlass.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch((error) => {
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

    if((oThis.currentStep === 'init_transfer') && oThis.status === 'done') {
      oThis.queueApproveForStakeAndMint();

      return Promise.resolve();
    }

    if((oThis.currentStep === 'approve_for_stake_and_mint') && oThis.status === 'done') {
      oThis.queueStartStakeForSTPrime();
      oThis.queueStartStakeForBT();
      return Promise.resolve();
    }

    if(['st_prime_stake_and_mint_complete', 'bt_stake_and_mint_complete'].includes(oThis.currentStep)
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
      criticalChainInteractionLogConst.stakerInitialTransferActivityType]
    ;

    var requestParams = {};

    if(!oThis.parentCriticalInteractionLogId) {
      const clientBrandedTokenRecords = await new ClientBrandedTokenModel().select('id').where(['symbol=?', oThis.tokenSymbol]).fire();
      const clientBrandedToken = clientBrandedTokenRecords[0];

      if(!clientBrandedToken){
        return Promise.reject(responseHelper.error('l_ob_r_2', 'no client branded token found for symbol'+oThis.tokenSymbol, null,
          {}, {sendErrorEmail: false}));
      }

      oThis.clientBrandedTokenId = clientBrandedToken.id;

      requestParams = {
        client_id: oThis.clientId,
        token_symbol: oThis.tokenSymbol,
        stake_and_mint_params: oThis.stakeAndMintParams
      };
    }

    const queueBackgroundJobResponse = await oThis.queueBackgroundJob(activityType,
      notificationTopics.stakeAndMintInitTransfer, requestParams);

    if(queueBackgroundJobResponse.isFailure()) return queueBackgroundJobResponse;

    oThis.parentCriticalInteractionLogId = queueBackgroundJobResponse.data.critical_chain_interaction_log_id;
    oThis.parentActivityType = criticalChainInteractionLogConst.stakerInitialTransferActivityType;

    return Promise.resolve(queueBackgroundJobResponse);
  },

  /**
   * Queue Approve for stake and mint
   *
   * @return {promise<result>}
   */
  queueApproveForStakeAndMint: function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
      criticalChainInteractionLogConst.stakeApprovalStartedActivityType]
    ;

    return oThis.queueBackgroundJob(activityType, notificationTopics.stakeAndMintApprove);
  },

  /**
   * Queue start stake for ST Prime
   *
   * @return {promise<result>}
   */
  queueStartStakeForSTPrime: function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
      criticalChainInteractionLogConst.stakeStPrimeStartedActivityType]
    ;

    return oThis.queueBackgroundJob(activityType, notificationTopics.stakeAndMintForSTPrime);
  },

  /**
   * Queue start stake for BT
   *
   * @return {promise<result>}
   */
  queueStartStakeForBT: function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
      criticalChainInteractionLogConst.stakeBtStartedActivityType]
    ;

    return oThis.queueBackgroundJob(activityType, notificationTopics.stakeAndMintForBT);
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
      client_branded_token_id: oThis.clientBrandedTokenId,
      parent_activity_type: oThis.parentActivityType
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

module.exports = StakeAndMintRouterKlass;