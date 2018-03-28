"use strict";

const openSTNotification = require('@openstfoundation/openst-notification')
;

const rootPrefix = '../..'
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
  , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , StakeAndMintRouter = require(rootPrefix + '/lib/stake_and_mint/router')
  , AllocateAirdropRouter = require(rootPrefix + '/lib/allocate_airdrop/router')
;

const RouterKlass = function (params) {
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

RouterKlass.prototype = {
  perform: async function () {
    const oThis = this
    ;

    if(oThis.currentStep === 'init') {
      return oThis.init();
    }

    if((oThis.currentStep === 'propose') && oThis.status === 'done') {
      oThis.queueDeployAirdrop();
      oThis.queueStakeAndMint();

      return Promise.resolve();
    }

    if((oThis.currentStep === 'deploy_airdrop') && oThis.status === 'done') {
      oThis.queueSetWorkers();
      oThis.queueSetPriceOracle();
      oThis.queueSetAcceptedMargin();
      return Promise.resolve();
    }

    if(['set_workers', 'set_price_oracle', 'set_accepted_margin'].includes(oThis.currentStep)
      && oThis.status === 'done') {
      return oThis.queueAllocateAirdrop();
    }

  },

  init: async function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
      criticalChainInteractionLogConst.proposeBtActivityType]
    ;

    const clientBrandedTokenRecords = await new ClientBrandedTokenModel().select('id').where(['symbol=?', oThis.tokenSymbol]).fire();
    const clientBrandedToken = clientBrandedTokenRecords[0];

    if(!clientBrandedToken){
     return Promise.reject(responseHelper.error('l_ob_r_1', 'no client branded token found for symbol'+oThis.tokenSymbol, null,
       {}, {sendErrorEmail: false}));
    }

    oThis.clientBrandedTokenId = clientBrandedToken.id;

    const requestParams = {
      client_id: oThis.clientId,
      token_symbol: oThis.tokenSymbol,
      stake_and_mint_params: oThis.stakeAndMintParams,
      airdrop_params: oThis.stakeAndMintParams
    };

    const queueBackgroundJobResponse = await oThis.queueBackgroundJob(activityType, 'on_boarding.propose', requestParams);
    if(queueBackgroundJobResponse.isFailure()) return queueBackgroundJobResponse;

    oThis.parentCriticalInteractionLogId = queueBackgroundJobResponse.data.critical_chain_interaction_log_id;
    oThis.parentActivityType = criticalChainInteractionLogConst.proposeBtActivityType;

    return Promise.resolve(queueBackgroundJobResponse);
  },

  create_propose_critical_log: async function () {

  },

  queueDeployAirdrop: function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
      criticalChainInteractionLogConst.deployAirdropActivityType]
    ;

    return oThis.queueBackgroundJob(activityType, 'on_boarding.deploy_airdrop');
  },

  queueStakeAndMint: function () {
    const oThis = this
    ;

    return new StakeAndMintRouter({
      current_step: 'init',
      token_symbol: oThis.tokenSymbol,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      parent_critical_interaction_log_id: oThis.parentCriticalInteractionLogId,
      client_branded_token_id: oThis.clientBrandedTokenId,
      parent_activity_type: oThis.parentActivityType
    }).init();
  },

  queueSetWorkers: function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
      criticalChainInteractionLogConst.setWorkerActivityType]
    ;

    return oThis.queueBackgroundJob(activityType, 'on_boarding.set_workers');
  },


  queueSetPriceOracle: function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.setPriceOracleActivityType]
    ;

    return oThis.queueBackgroundJob(activityType, 'on_boarding.set_price_oracle');
  },

  queueSetAcceptedMargin: function () {
    const oThis = this
      , activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.setAcceptedMarginActivityType]
    ;

    return oThis.queueBackgroundJob(activityType, 'on_boarding.set_price_oracle');
  },

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
      request_params: JSON.stringify(requestParams || {})
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