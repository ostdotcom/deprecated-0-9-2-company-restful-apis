'use strict';

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  notificationTopics = require(rootPrefix + '/lib/global_constant/notification_topics'),
  criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log'),
  CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  ConnectionTimeoutConst = require(rootPrefix + '/lib/global_constant/connection_timeout'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

const AllocateAirdropRouterKlass = function(params) {
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

  oThis.airdropParams = params.airdrop_params;
};

AllocateAirdropRouterKlass.prototype = {
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
          internal_error_identifier: 'l_aa_r_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: { error: error },
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
      return await oThis.init();
    }

    return Promise.reject(
      responseHelper.error({
        internal_error_identifier: 'l_aa_r_2',
        api_error_identifier: 'unhandled_catch_response',
        error_config: errorConfig
      })
    );
  },

  /**
   * Init
   *
   * @return {Promise<result>}
   */
  init: async function() {
    const oThis = this,
      activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[
        criticalChainInteractionLogConst.airdropUsersActivityType
      ],
      processedStatus = new CriticalChainInteractionLogModel().invertedStatuses[
        criticalChainInteractionLogConst.processedStatus
      ];

    let requestParams = {};

    if (!oThis.parentCriticalInteractionLogId) {
      const clientBrandedTokenRecords = await new ClientBrandedTokenModel()
        .select('id')
        .where(['symbol=?', oThis.tokenSymbol])
        .fire();
      const clientBrandedToken = clientBrandedTokenRecords[0];

      if (!clientBrandedToken) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'l_aa_r_3',
            api_error_identifier: 'invalid_branded_token',
            debug_options: { tokenSymbol: oThis.tokenSymbol },
            error_config: errorConfig
          })
        );
      }

      oThis.clientBrandedTokenId = clientBrandedToken.id;

      requestParams = {
        client_id: oThis.clientId,
        client_token_id: oThis.clientTokenId,
        token_symbol: oThis.tokenSymbol,
        airdrop_params: oThis.airdropParams
      };
    } else {
      // check if all the steps in the current parentCriticalInteractionLogId are complete
      // if not exit from here.
      const otherCriticalInteractionLogRecords = await new CriticalChainInteractionLogModel()
        .select('status')
        .where(['parent_id = ?', oThis.parentCriticalInteractionLogId])
        .fire();

      for (let i = 0; i < otherCriticalInteractionLogRecords.length; i++) {
        if (otherCriticalInteractionLogRecords[i].status != processedStatus) {
          logger.info('l_aa_r_3', 'waiting for dependency tasks to be processed.');
          return Promise.resolve(responseHelper.successWithData({}));
        }
      }

      // check if the chain has airdrop params to proceed.
      const criticalChainInteractionLogs = await new CriticalChainInteractionLogModel().getByIds([
        oThis.parentCriticalInteractionLogId
      ]);

      const parentCriticalChainInteractionLog = criticalChainInteractionLogs[oThis.parentCriticalInteractionLogId],
        airdropParams = parentCriticalChainInteractionLog.request_params.airdrop_params;

      if (!airdropParams || !airdropParams.airdrop_amount || !airdropParams.airdrop_user_list_type) {
        return Promise.resolve(responseHelper.successWithData({}));
      }
    }

    const queueBackgroundJobResponse = await oThis.queueBackgroundJob(
      activityType,
      notificationTopics.airdropAllocateTokens,
      requestParams
    );

    if (queueBackgroundJobResponse.isFailure()) return queueBackgroundJobResponse;

    if (!oThis.parentCriticalInteractionLogId) {
      oThis.parentCriticalInteractionLogId = queueBackgroundJobResponse.data.critical_chain_interaction_log_id;
    }

    return Promise.resolve(queueBackgroundJobResponse);
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
      request_params: requestParams || {},
      response_data: {}
    };
    const openSTNotification = await SharedRabbitMqProvider.getInstance({
      connectionWaitSeconds: ConnectionTimeoutConst.appServer,
      switchConnectionWaitSeconds: ConnectionTimeoutConst.switchConnectionAppServer
    });
    const dbRecordResponse = await new CriticalChainInteractionLogModel().insertRecord(createParams),
      dbRecord = dbRecordResponse.data.dbRecord;

    // if parent critical interaction log id is present, check for duplicates being introduced due to the las insert.
    if (oThis.parentCriticalInteractionLogId) {
      const similarRecordIds = [];
      const allSiblingRecords = await new CriticalChainInteractionLogModel()
        .select('id, activity_type')
        .where(['parent_id = ?', oThis.parentCriticalInteractionLogId])
        .fire();

      for (let i = 0; i < allSiblingRecords.length; i++) {
        if (allSiblingRecords.activity_type == activityType) similarRecordIds.push(allSiblingRecords[i].id);
      }

      if (similarRecordIds.length > 1) {
        if (Math.min(...similarRecordIds) != dbRecord.insertId) {
          // self destruct
          new CriticalChainInteractionLogModel().delete().where(['id = ?', dbRecord.insertId]);
          return Promise.resolve(
            responseHelper.error({
              internal_error_identifier: 'l_aa_r_4',
              api_error_identifier: 'duplicate_record',
              error_config: errorConfig
            })
          );
        }
      }
    }

    const payload = {
      parent_critical_interaction_log_id: oThis.parentCriticalInteractionLogId,
      critical_interaction_log_id: dbRecord.insertId,
      client_id: oThis.clientId
    };

    openSTNotification.publishEvent
      .perform({
        topics: [topic],
        publisher: 'OST',
        message: {
          kind: 'background_job',
          payload: payload
        }
      })
      .catch(function(err) {
        logger.error('Message for airdrop router was not published. Payload: ', payload, ' Error: ', err);
      });

    return Promise.resolve(responseHelper.successWithData({ critical_chain_interaction_log_id: dbRecord.insertId }));
  }
};

module.exports = AllocateAirdropRouterKlass;
