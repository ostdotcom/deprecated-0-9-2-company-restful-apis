'use strict';

/**
 * Set accepted margin to airdrop contract.
 *
 * @module lib/on_boarding/set_accepted_margin
 *
 */

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log'),
  criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log'),
  OnBoardingRouter = require(rootPrefix + '/lib/on_boarding/router'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

require(rootPrefix + '/lib/providers/payments');

/**
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.critical_interaction_log_id - critical chain interactions log id
 * @param {number} params.parent_critical_interaction_log_id - parent of critical chain interactions log id
 *
 */
const SetAcceptedMarginKlass = function(params) {
  const oThis = this;

  oThis.criticalChainInteractionLogId = parseInt(params.critical_interaction_log_id);
  oThis.parentCriticalInteractionLogId = parseInt(params.parent_critical_interaction_log_id);

  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;
  oThis.brandedTokenId = null;
  oThis.clientId = null;
  oThis.clientTokenId = null;
  oThis.brandedToken = null;

  oThis.acceptedMargin = coreConstants.ACCEPTED_PRICE_FLUCTUATION_FOR_PAYMENT.OST.USD;
  oThis.airDropContractAddress = '';
};

SetAcceptedMarginKlass.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(async function(error) {
      var errorObj = null,
        duplicateCriticalLog = false;

      // something unhandled happened
      logger.error('lib/on_boarding/set_accepted_margin.js::perform::catch');
      logger.error(error);
      if (responseHelper.isCustomResult(error)) {
        errorObj = error;
        duplicateCriticalLog = errorObj
          .toHash()
          .err.internal_id.includes(criticalChainInteractionLogConst.ER_DUP_ENTRY);
      } else {
        errorObj = responseHelper.error({
          internal_error_identifier: 'l_ob_sam_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: { error: error, clientId: oThis.clientId },
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
   * Async perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this,
      paymentsProvider = oThis.ic().getPaymentsProvider(),
      configStrategy = oThis.ic().configStrategy,
      openSTPayments = paymentsProvider.getInstance(),
      AirdropManagerSetAcceptedMarginKlass = openSTPayments.services.airdropManager.setAcceptedMargin;

    await oThis.setCriticalChainInteractionLog();

    await oThis.validateAndSanitize();

    oThis._criticalLogDebug('* Updating critical chain interaction log', 'debug');
    new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
      oThis.criticalChainInteractionLogId,
      {
        status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.pendingStatus]
      },
      oThis.parentCriticalInteractionLogId,
      oThis.clientTokenId
    );

    const setAcceptedMarginObject = new AirdropManagerSetAcceptedMarginKlass({
      airdrop_contract_address: oThis.airDropContractAddress,
      chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
      sender_address: configStrategy.OST_UTILITY_OPS_ADDR,
      sender_passphrase: configStrategy.OST_UTILITY_OPS_PASSPHRASE,
      currency: 'USD',
      accepted_margin: oThis.acceptedMargin,
      gas_price: configStrategy.OST_UTILITY_GAS_PRICE,
      options: { tag: 'airdrop.setAcceptedMargin', returnType: 'txReceipt' }
    });

    oThis._criticalLogDebug('* Performing set accepted margin', 'step');
    const setAcceptedMarginResponse = await setAcceptedMarginObject.perform();

    if (setAcceptedMarginResponse.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_sam_2',
          api_error_identifier: 'setAcceptedMargin_failed',
          debug_options: { setAcceptedMarginResponse: setAcceptedMarginResponse },
          error_config: errorConfig
        })
      );
    } else {
      await new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
        oThis.criticalChainInteractionLogId,
        {
          status: new CriticalChainInteractionLogModel().invertedStatuses[
            criticalChainInteractionLogConst.processedStatus
          ],
          transaction_hash: setAcceptedMarginResponse.data.transaction_receipt.transactionHash
        },
        oThis.parentCriticalInteractionLogId,
        oThis.clientTokenId
      );
    }

    const callRouterRsp = await new OnBoardingRouter({
      current_step: 'set_accepted_margin',
      status: 'done',

      utility_chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
      value_chain_id: configStrategy.OST_VALUE_CHAIN_ID,
      token_symbol: oThis.parentCriticalChainInteractionLog.request_params.token_symbol,
      client_id: oThis.criticalChainInteractionLog.client_id,
      client_token_id: oThis.criticalChainInteractionLog.client_token_id,
      parent_critical_interaction_log_id: oThis.parentCriticalChainInteractionLog.id,
      client_branded_token_id: oThis.criticalChainInteractionLog.client_branded_token_id
    }).perform();

    if (callRouterRsp.isFailure()) {
      return Promise.reject(callRouterRsp);
    }

    return Promise.resolve(setAcceptedMarginResponse);
  },

  /**
   * set critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  setCriticalChainInteractionLog: async function() {
    const oThis = this,
      criticalChainInteractionLogs = await new CriticalChainInteractionLogModel().getByIds([
        oThis.criticalChainInteractionLogId,
        oThis.parentCriticalInteractionLogId
      ]),
      criticalChainInteractionLog = criticalChainInteractionLogs[oThis.criticalChainInteractionLogId],
      parentCriticalChainInteractionLog = criticalChainInteractionLogs[oThis.parentCriticalInteractionLogId];

    if (!criticalChainInteractionLog) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_sam_2',
          api_error_identifier: 'data_not_found',
          error_config: errorConfig
        })
      );
    }

    if (!parentCriticalChainInteractionLog) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_sam_2.1',
          api_error_identifier: 'data_not_found',
          error_config: errorConfig
        })
      );
    }

    oThis.criticalChainInteractionLog = criticalChainInteractionLog;
    oThis.parentCriticalChainInteractionLog = parentCriticalChainInteractionLog;

    oThis.brandedTokenId = oThis.criticalChainInteractionLog.client_branded_token_id;
    oThis.clientId = oThis.criticalChainInteractionLog.client_id;
    oThis.clientTokenId = oThis.criticalChainInteractionLog.client_token_id;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * validate and sanitize.
   *
   * sets airDropContractAddress
   *
   * @return {Promise.<result>}
   */
  validateAndSanitize: async function() {
    const oThis = this;

    oThis._criticalLogDebug('* Validating set accepted margin params', 'debug');
    if (!oThis.brandedTokenId || !oThis.clientId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_spo_3',
          api_error_identifier: 'invalid_params',
          error_config: errorConfig
        })
      );
    }

    const clientBrandedToken = await new ClientBrandedTokenModel()
      .select('*')
      .where(['id=?', oThis.brandedTokenId])
      .fire();
    oThis.brandedToken = clientBrandedToken[0];

    if (oThis.brandedToken.client_id !== oThis.clientId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_spo_4',
          api_error_identifier: 'client_branded_token_not_found',
          error_config: errorConfig
        })
      );
    }

    oThis.airDropContractAddress = oThis.brandedToken.airdrop_contract_addr;

    if (!oThis.airDropContractAddress) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_spo_5',
          api_error_identifier: 'airdrop_contract_not_found',
          error_config: errorConfig
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  _criticalLogDebug: function(message, messageKind) {
    const oThis = this;
    let parentId = oThis.parentCriticalInteractionLogId || '-';
    logger[messageKind].apply(logger, ['[p' + parentId + '][s' + oThis.criticalChainInteractionLogId + ']', message]);
  }
};

InstanceComposer.registerShadowableClass(SetAcceptedMarginKlass, 'getSetAcceptedMarginClass');

module.exports = SetAcceptedMarginKlass;
