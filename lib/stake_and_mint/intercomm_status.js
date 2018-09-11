'use strict';

const rootPrefix = '../..',
  CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log'),
  criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ManagedAdressModel = require(rootPrefix + '/app/models/managed_address'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  StakeAndMintRouter = require(rootPrefix + '/lib/stake_and_mint/router'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  ConfigStartegyHelperKlass = require(rootPrefix + '/helpers/config_strategy'),
  configStrategyHelper = new ConfigStartegyHelperKlass(),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  InstanceComposer = require(rootPrefix + '/instance_composer');

const IntercommStatusKlass = function(params) {
  const oThis = this;

  oThis.errorData = params.error_data;
  oThis.status = params.status;
  oThis.transactionHash = params.transaction_hash;
  oThis.stakingParams = params.staking_params;
  oThis.benificiaryAddress = params.benificiary_address;
  oThis.amount = params.amount;
  oThis.tokenType = params.token_type;
  oThis.erc20Address = params.erc20_address;

  oThis.criticalChainInteractionLogId = null;
  oThis.criticalChainInteractionLog = null;

  oThis.parentCriticalInteractionLogId = null;
  oThis.parentCriticalChainInteractionLog = null;

  oThis.clientId = null;
  oThis.clientTokenId = null;
  oThis.configStrategy = null;
};

IntercommStatusKlass.prototype = {
  /**
   * Perform
   *
   * @returns {promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(async function(error) {
      var errorObj = null,
        duplicateCriticalLog = false;

      // something unhandled happened
      logger.error('lib/stake_and_mint/intercomm_status.js::perform::catch');
      logger.error(error);

      if (responseHelper.isCustomResult(error)) {
        errorObj = error;
        duplicateCriticalLog = errorObj
          .toHash()
          .err.internal_id.includes(criticalChainInteractionLogConst.ER_DUP_ENTRY);
      } else {
        errorObj = responseHelper.error({
          internal_error_identifier: 'l_sam_is_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: { error: error },
          error_config: errorConfig
        });
      }

      if (oThis.criticalChainInteractionLog && !duplicateCriticalLog) {
        await new CriticalChainInteractionLogModel()
          .updateCriticalChainInteractionLog(
            oThis.criticalChainInteractionLogId,
            {
              status: new CriticalChainInteractionLogModel().invertedStatuses[
                criticalChainInteractionLogConst.failedStatus
              ],
              response_data: errorObj.toHash()
            },
            oThis.parentCriticalInteractionLogId,
            oThis.clientTokenId
          )
          .catch(function(err) {
            logger.error('lib/stake_and_mint/intercomm_status.js::perform::catch::updateCriticalChainInteractionLog');
            logger.error(err);
          });
      }

      return errorObj;
    });
  },

  /**
   * Perform<br><br>
   *
   * @return {promise<result>}
   *
   */
  asyncPerform: async function() {
    const oThis = this;

    if (!oThis.status.includes('failed') && oThis.status !== 'claim_token_on_uc_done') {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    await oThis.setCriticalChainInteractionLog();

    // if status contains failed OR status == 'claim_token_on_uc_done' process
    if (oThis.status.includes('failed')) {
      await oThis.markCriticalInteractionLogFailed();

      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_sam_is_2',
          api_error_identifier: 'stake_and_mint_processor_error',
          debug_options: { error_data: oThis.errorData },
          error_config: errorConfig
        })
      );
    }

    let response = await configStrategyHelper.getConfigStrategy(oThis.clientId);

    if (response.isFailure()) {
      return Promise.reject(response);
    }

    oThis.configStrategy = response.data;

    if (oThis.status === 'claim_token_on_uc_done' && oThis.tokenType === 'bt') {
      let instanceComposer = new InstanceComposer(oThis.configStrategy),
        storageProvider = instanceComposer.getStorageProvider(),
        openSTStorage = storageProvider.getInstance(),
        tokenBalanceShardName = response.data.TOKEN_BALANCE_SHARD_NAME;

      const balanceUpdateResponse = await new openSTStorage.model.TokenBalance({
        erc20_contract_address: oThis.erc20Address,
        shard_name: tokenBalanceShardName
      }).update({
        ethereum_address: oThis.benificiaryAddress,
        settle_amount: oThis.amount
      });

      if (balanceUpdateResponse.isFailure()) {
        return balanceUpdateResponse;
      }
    }

    // For Bt, process marked done only after balance is settled from block scanner.
    // if(oThis.stakingParams.tokenType=='bt'){
    //   return Promise.resolve(responseHelper.successWithData({}));
    // }

    await oThis.markCriticalInteractionLogProcessed();

    // Inform router when done
    await oThis.informRouterAboutCompletion();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  setCriticalChainInteractionLog: async function() {
    const oThis = this,
      reserveAddress = oThis.stakingParams.beneficiary;

    const activityTypeStr =
      oThis.stakingParams.tokenType == 'bt'
        ? criticalChainInteractionLogConst.stakeBtStartedActivityType
        : criticalChainInteractionLogConst.stakeStPrimeStartedActivityType;

    const activityType = new CriticalChainInteractionLogModel().invertedActivityTypes[activityTypeStr];

    const manageAddressRecord = (await new ManagedAdressModel()
      .select('id')
      .where(['ethereum_address=?', reserveAddress])
      .fire())[0];

    if (!manageAddressRecord) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_sam_is_3',
          api_error_identifier: 'no_data_found',
          debug_options: { reserveAddress: reserveAddress },
          error_config: errorConfig
        })
      );
    }

    const clientBrandedToken = (await new ClientBrandedTokenModel()
      .select('*')
      .where({ reserve_managed_address_id: manageAddressRecord.id })
      .fire())[0];

    if (!clientBrandedToken) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_sam_is_4',
          api_error_identifier: 'invalid_branded_token',
          debug_options: { manageAddressRecordId: manageAddressRecord.id },
          error_config: errorConfig
        })
      );
    }

    oThis.criticalChainInteractionLog = (await new CriticalChainInteractionLogModel()
      .select('*')
      .where(['client_id=? AND activity_type=?', clientBrandedToken.client_id, activityType])
      .order_by('id DESC')
      .limit(1)
      .fire())[0];

    if (!oThis.criticalChainInteractionLog) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_sam_is_5',
          api_error_identifier: 'no_data_found',
          debug_options: { clientBrandedToken: clientBrandedToken },
          error_config: errorConfig
        })
      );
    }

    oThis.criticalChainInteractionLogId = oThis.criticalChainInteractionLog.id;
    oThis.parentCriticalInteractionLogId =
      oThis.criticalChainInteractionLog.parent_id || oThis.criticalChainInteractionLog.id;

    if (oThis.criticalChainInteractionLogId != oThis.parentCriticalInteractionLogId) {
      oThis.parentCriticalChainInteractionLog = (await new CriticalChainInteractionLogModel()
        .select('*')
        .where(['id=?', oThis.parentCriticalInteractionLogId])
        .fire())[0];
    } else {
      oThis.parentCriticalChainInteractionLog = oThis.criticalChainInteractionLog;
    }

    oThis.clientId = clientBrandedToken.client_id;
    oThis.clientTokenId = oThis.criticalChainInteractionLog.client_token_id;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Update critical interaction log.
   *
   * @returns {promise<result>}
   */
  markCriticalInteractionLogProcessed: async function() {
    const oThis = this;

    // marking self as processed
    oThis._criticalLogDebug('* Marking critical chain interaction log as processed', 'debug');
    await new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
      oThis.criticalChainInteractionLogId,
      {
        status: new CriticalChainInteractionLogModel().invertedStatuses[
          criticalChainInteractionLogConst.processedStatus
        ]
      },
      oThis.parentCriticalInteractionLogId,
      oThis.clientTokenId
    );

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Update critical interaction log.
   *
   * @returns {promise<result>}
   */
  markCriticalInteractionLogFailed: async function() {
    const oThis = this;

    // marking self as processed
    oThis._criticalLogDebug('* Marking critical chain interaction log as failed', 'debug');

    await new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
      oThis.criticalChainInteractionLogId,
      {
        response_data: oThis.errorData,
        status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.failedStatus]
      },
      oThis.parentCriticalInteractionLogId,
      oThis.clientTokenId
    );

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * inform router about completion
   *
   * @returns {promise<result>}
   */
  informRouterAboutCompletion: async function() {
    const oThis = this;

    const current_step =
      oThis.stakingParams.tokenType === 'bt' ? 'bt_stake_and_mint_complete' : 'st_prime_stake_and_mint_complete';

    const callRouterRsp = await new StakeAndMintRouter({
      current_step: current_step,
      status: 'done',

      utility_chain_id: oThis.configStrategy.OST_UTILITY_CHAIN_ID,
      value_chain_id: oThis.configStrategy.OST_VALUE_CHAIN_ID,
      token_symbol: oThis.parentCriticalChainInteractionLog.request_params.token_symbol,
      client_id: oThis.criticalChainInteractionLog.client_id,
      client_token_id: oThis.criticalChainInteractionLog.client_token_id,
      parent_critical_interaction_log_id: oThis.parentCriticalChainInteractionLog.id,
      perform_airdrop: oThis.criticalChainInteractionLogId != oThis.parentCriticalInteractionLogId,
      client_branded_token_id: oThis.criticalChainInteractionLog.client_branded_token_id
    }).perform();

    if (callRouterRsp.isFailure()) {
      return Promise.reject(callRouterRsp);
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  _criticalLogDebug: function(message, messageKind) {
    const oThis = this;
    let parentId = oThis.parentCriticalInteractionLogId || '-';
    logger[messageKind].apply(logger, ['[p' + parentId + '][s' + oThis.criticalChainInteractionLogId + ']', message]);
  }
};

module.exports = IntercommStatusKlass;
