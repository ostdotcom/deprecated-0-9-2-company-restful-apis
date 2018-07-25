'use strict';

const openSTNotification = require('@openstfoundation/openst-notification');

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  notificationTopics = require(rootPrefix + '/lib/global_constant/notification_topics'),
  criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log'),
  CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  AllocateAirdropRouter = require(rootPrefix + '/lib/allocate_airdrop/router'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

const StakeAndMintRouterKlass = function(params) {
  const oThis = this;

  oThis.currentStep = params.current_step;
  oThis.status = params.status;

  oThis.tokenSymbol = params.token_symbol;
  oThis.clientId = params.client_id;
  oThis.clientTokenId = params.client_token_id;
  oThis.parentCriticalInteractionLogId = params.parent_critical_interaction_log_id;
  oThis.clientBrandedTokenId = params.client_branded_token_id;
  oThis.performAirdrop = params.perform_airdrop;
  oThis.stakeAndMintParams = params.stake_and_mint_params;
  oThis.transactionHash = null;
};

StakeAndMintRouterKlass.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
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
   * @return {promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this;

    if (oThis.currentStep === 'init') {
      return oThis.init();
    }

    if (oThis.currentStep === 'init_transfer' && oThis.status === 'done') {
      oThis.queueApproveForStakeAndMint();

      return Promise.resolve(responseHelper.successWithData({}));
    }

    if (oThis.currentStep === 'approve_for_stake_and_mint' && oThis.status === 'done') {
      let zeroBn = basicHelper.convertToBigNumber(0);
      if (
        oThis.stakeAndMintParams.bt_to_mint &&
        basicHelper.convertToBigNumber(oThis.stakeAndMintParams.bt_to_mint).gt(zeroBn)
      ) {
        oThis.queueStartStakeForBT();
      }
      if (
        oThis.stakeAndMintParams.st_prime_to_mint &&
        basicHelper.convertToBigNumber(oThis.stakeAndMintParams.st_prime_to_mint).gt(zeroBn)
      ) {
        oThis.queueStartStakeForSTPrime();
      }
      return Promise.resolve(responseHelper.successWithData({}));
    }

    if (
      ['st_prime_stake_and_mint_complete', 'bt_stake_and_mint_complete'].includes(oThis.currentStep) &&
      oThis.status === 'done' &&
      oThis.performAirdrop
    ) {
      return oThis.queueAllocateAirdrop();
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Init
   *
   * @return {promise<result>}
   */
  init: async function() {
    const oThis = this,
      activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.stakerInitialTransferActivityType
      ];

    var requestParams = {};

    if (!oThis.parentCriticalInteractionLogId) {
      const clientBrandedTokenRecords = await new ClientBrandedTokenModel()
        .select('id')
        .where({ symbol: oThis.tokenSymbol })
        .fire();

      const clientBrandedToken = clientBrandedTokenRecords[0];

      if (!clientBrandedToken) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'l_ob_r_2',
            api_error_identifier: 'invalid_branded_token',
            debug_options: { tokenSymbol: oThis.tokenSymbol },
            error_config: errorConfig
          })
        );
      }

      oThis.clientBrandedTokenId = clientBrandedToken.id;

      requestParams = {
        client_id: oThis.clientId,
        token_symbol: oThis.tokenSymbol,
        stake_and_mint_params: oThis.stakeAndMintParams
      };

      oThis.transactionHash = oThis.stakeAndMintParams.transaction_hash;
    } else {
      const criticalChainInteractionLogs = await new CriticalChainInteractionLogModel().getByIds([
          oThis.parentCriticalInteractionLogId
        ]),
        parentCriticalChainInteractionLog = criticalChainInteractionLogs[oThis.parentCriticalInteractionLogId];

      if (!parentCriticalChainInteractionLog) {
        const errorRsp = responseHelper.error({
          internal_error_identifier: 'l_ob_r_3',
          api_error_identifier: 'no_data_found',
          error_config: errorConfig
        });
        return Promise.reject(errorRsp);
      }

      oThis.transactionHash = parentCriticalChainInteractionLog.request_params.stake_and_mint_params.transaction_hash;
    }

    const queueBackgroundJobResponse = await oThis.queueBackgroundJob(
      activityType,
      notificationTopics.stakeAndMintInitTransfer,
      requestParams,
      oThis.transactionHash
    );

    if (queueBackgroundJobResponse.isFailure()) return queueBackgroundJobResponse;

    if (!oThis.parentCriticalInteractionLogId) {
      oThis.parentCriticalInteractionLogId = queueBackgroundJobResponse.data.critical_chain_interaction_log_id;
    }

    return Promise.resolve(queueBackgroundJobResponse);
  },

  /**
   * Queue Approve for stake and mint
   *
   * @return {promise<result>}
   */
  queueApproveForStakeAndMint: function() {
    const oThis = this,
      activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.stakeApprovalStartedActivityType
      ];

    return oThis.queueBackgroundJob(activityType, notificationTopics.stakeAndMintApprove);
  },

  /**
   * Queue start stake for ST Prime
   *
   * @return {promise<result>}
   */
  queueStartStakeForSTPrime: function() {
    const oThis = this,
      activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.stakeStPrimeStartedActivityType
      ];

    return oThis.queueBackgroundJob(activityType, notificationTopics.stakeAndMintForSTPrime);
  },

  /**
   * Queue start stake for BT
   *
   * @return {promise<result>}
   */
  queueStartStakeForBT: function() {
    const oThis = this,
      activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.stakeBtStartedActivityType
      ];

    return oThis.queueBackgroundJob(activityType, notificationTopics.stakeAndMintForBT);
  },

  /**
   * Queue Allocate Airdrop
   *
   * @return {promise<result>}
   */
  queueAllocateAirdrop: function() {
    const oThis = this;

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
  queueBackgroundJob: async function(activityType, topic, requestParams, transactionHash) {
    const oThis = this,
      status = new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.queuedStatus];

    var chainType = null;

    var valueChainTypes = [
      new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.stakerInitialTransferActivityType
      ],
      new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.stakeApprovalStartedActivityType
      ],
      new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.stakeBtStartedActivityType
      ],
      new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.stakeStPrimeStartedActivityType
      ]
    ];

    if (valueChainTypes.indexOf(activityType) >= 0) {
      chainType = new CriticalChainInteractionLogModel().invertedChainTypes[
        criticalChainInteractionLogConst.valueChainType
      ];
    } else {
      chainType = new CriticalChainInteractionLogModel().invertedChainTypes[
        criticalChainInteractionLogConst.utilityChainType
      ];
    }

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

    if (transactionHash) {
      createParams.transaction_hash = transactionHash;
    }

    const dbRecord = await new CriticalChainInteractionLogModel().insertRecord(createParams);

    openSTNotification.publishEvent.perform({
      topics: [topic],
      publisher: 'OST',
      message: {
        kind: 'background_job',
        payload: {
          parent_critical_interaction_log_id: oThis.parentCriticalInteractionLogId,
          critical_interaction_log_id: dbRecord.insertId
        }
      }
    });

    return Promise.resolve(responseHelper.successWithData({ critical_chain_interaction_log_id: dbRecord.insertId }));
  }
};

module.exports = StakeAndMintRouterKlass;
