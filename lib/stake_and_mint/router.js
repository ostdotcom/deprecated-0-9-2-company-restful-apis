'use strict';

const rootPrefix = '../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  AllocateAirdropRouter = require(rootPrefix + '/lib/allocate_airdrop/router'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  notificationTopics = require(rootPrefix + '/lib/global_constant/notification_topics'),
  ConnectionTimeoutConst = require(rootPrefix + '/lib/global_constant/connection_timeout'),
  CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log'),
  criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

const StakeAndMintRouterKlass = function(params) {
  const oThis = this;

  oThis.currentStep = params.current_step;
  oThis.status = params.status;

  oThis.tokenSymbol = params.token_symbol;
  oThis.utilityChainId = params.utility_chain_id;
  oThis.valueChainId = params.value_chain_id;
  oThis.clientId = params.client_id;
  oThis.clientTokenId = params.client_token_id;
  oThis.parentCriticalInteractionLogId = params.parent_critical_interaction_log_id;
  oThis.clientBrandedTokenId = params.client_branded_token_id;
  oThis.performAirdrop = params.perform_airdrop;
  oThis.stakeAndMintParams = params.stake_and_mint_params;
  oThis.transactionHash = null;
  oThis.parentCriticalInteractionLog = null;
};

StakeAndMintRouterKlass.prototype = {
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

    if (oThis.parentCriticalInteractionLogId && !oThis.parentCriticalInteractionLog) {
      await oThis.setParentCriticalInteractionLog();
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
   * @return {Promise<result>}
   */
  init: async function() {
    const oThis = this,
      activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.stakerInitialTransferActivityType
      ];

    let requestParams = {};

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
      await oThis.setParentCriticalInteractionLog();

      oThis.transactionHash = oThis.parentCriticalInteractionLog.request_params.stake_and_mint_params.transaction_hash;
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
   * Set Parent Critical Log
   *
   * @return {Promise<result>}
   */
  setParentCriticalInteractionLog: async function() {
    const oThis = this;

    const criticalChainInteractionLogs = await new CriticalChainInteractionLogModel().getByIds([
        oThis.parentCriticalInteractionLogId
      ]),
      parentCriticalChainInteractionLog = criticalChainInteractionLogs[parseInt(oThis.parentCriticalInteractionLogId)];

    if (!parentCriticalChainInteractionLog) {
      const errorRsp = responseHelper.error({
        internal_error_identifier: 'l_ob_r_3',
        api_error_identifier: 'no_data_found',
        error_config: errorConfig
      });
      return Promise.reject(errorRsp);
    }

    oThis.parentCriticalInteractionLog = parentCriticalChainInteractionLog;
  },

  /**
   * Queue Approve for stake and mint
   *
   * @return {Promise<result>}
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
   * @return {Promise<result>}
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
   * @return {Promise<result>}
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
   * @return {Promise<result>}
   */
  queueAllocateAirdrop: function() {
    const oThis = this;

    return new AllocateAirdropRouter({
      current_step: 'init',
      utility_chain_id: oThis.utilityChainId,
      value_chain_id: oThis.valueChainId,
      token_symbol: oThis.tokenSymbol,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      parent_critical_interaction_log_id: oThis.parentCriticalInteractionLogId,
      client_branded_token_id: oThis.clientBrandedTokenId
    }).perform();
  },

  /**
   * Queue Background Job
   *
   * @return {Promise<result>}
   */
  queueBackgroundJob: async function(activityType, topic, requestParams, transactionHash) {
    const oThis = this,
      status = new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.queuedStatus];

    let chainType = null,
      chainId = null;

    let valueChainTypes = [
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
      chainId = oThis.valueChainId;
      chainType = new CriticalChainInteractionLogModel().invertedChainTypes[
        criticalChainInteractionLogConst.valueChainType
      ];
    } else {
      chainId = oThis.utilityChainId;
      chainType = new CriticalChainInteractionLogModel().invertedChainTypes[
        criticalChainInteractionLogConst.utilityChainType
      ];
    }

    const createParams = {
      chain_id: chainId,
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

    const dbRecordResponse = await new CriticalChainInteractionLogModel().insertRecord(createParams),
      dbRecord = dbRecordResponse.data.dbRecord,
      payload = {
        client_id: oThis.clientId,
        parent_critical_interaction_log_id: oThis.parentCriticalInteractionLogId,
        critical_interaction_log_id: dbRecord.insertId
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
        logger.error('Message for stake and mint router was not published. Payload: ', payload, ' Error: ', err);
      });

    return Promise.resolve(responseHelper.successWithData({ critical_chain_interaction_log_id: dbRecord.insertId }));
  }
};

module.exports = StakeAndMintRouterKlass;
