"use strict";

const openSTPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = '../..'
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
  , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , StakeAndMintRouter = require(rootPrefix + '/lib/stake_and_mint/router')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.general)
;

/**
 * Approve Staker Address's all amount to contract
 *
 * @constructor
 *
 * @module lib/stake_and_mint/approve
 *
 * @param {object} params - parameters object
 * @param {string} params.critical_interaction_log_id - id of criticial interaction log
 * @param {string} params.parent_critical_interaction_log_id - parent id of criticial interaction log
 *
 */
const ApproveKlass = function (params) {

  const oThis = this
  ;

  oThis.criticalChainInteractionLogId = parseInt(params.critical_interaction_log_id);
  oThis.parentCriticalInteractionLogId = parseInt(params.parent_critical_interaction_log_id);

  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;
  oThis.brandedTokenId = null;
  oThis.clientId = null;
  oThis.clientTokenId = null;
};

ApproveKlass.prototype = {

  /**
   * Perform
   *
   * @returns {promise<result>}
   */
  perform: function () {
    const oThis = this
    ;

    return oThis.asyncPerform()
      .catch(async function (error) {

        var errorObj = null;

        if (responseHelper.isCustomResult(error)) {
          errorObj = error;
        } else {
          // something unhandled happened
          logger.error('lib/stake_and_mint/approve.js::perform::catch');
          logger.error(error);

          errorObj = responseHelper.error({
            internal_error_identifier: 'l_sam_a_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {error: error, clientId: oThis.clientId},
            error_config: errorConfig
          });
        }

        if (oThis.criticalChainInteractionLog) {
          await new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
            oThis.criticalChainInteractionLogId,
            {
              status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.failedStatus],
              response_data: errorObj.toHash(),
            },
            oThis.parentCriticalInteractionLogId,
            oThis.clientTokenId
          ).catch(function (err) {
            logger.error('lib/stake_and_mint/approve.js::perform::catch::updateCriticalChainInteractionLog');
            logger.error(error);
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
  asyncPerform: async function () {
    const oThis = this
    ;

    await oThis.setCriticalChainInteractionLog();

    oThis.updateCriticalInteractionLog({
      status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.pendingStatus]
    });

    let approveResponse;
    approveResponse = await oThis.approve();

    oThis._criticalLogDebug('Updating critical chain interaction log', 'debug');

    await oThis.updateCriticalInteractionLog({
      status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.processedStatus],
      transaction_hash: approveResponse.data.transactionHash,
    });

    await oThis.informRouterAboutCompletion();

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * update critical interaction log id
   *
   * @returns {promise}
   */
  updateCriticalInteractionLog: function (dataToUpdate) {
    const oThis = this
    ;

    // marking self as processed
    return new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
      oThis.criticalChainInteractionLogId,
      dataToUpdate,
      oThis.parentCriticalInteractionLogId,
      oThis.clientTokenId
    );
  },

  /**
   * inform router about completion
   *
   * @returns {promise<result>}
   */
  informRouterAboutCompletion: async function () {
    const oThis = this
    ;

    const callRouterRsp = await new StakeAndMintRouter({
      current_step: 'approve_for_stake_and_mint',
      status: 'done',

      token_symbol: oThis.parentCriticalChainInteractionLog.request_params.token_symbol,
      client_id: oThis.criticalChainInteractionLog.client_id,
      client_token_id: oThis.criticalChainInteractionLog.client_token_id,
      parent_critical_interaction_log_id: oThis.parentCriticalChainInteractionLog.id,
      client_branded_token_id: oThis.criticalChainInteractionLog.client_branded_token_id,
      stake_and_mint_params: oThis.parentCriticalChainInteractionLog.request_params.stake_and_mint_params
    }).perform();

    if (callRouterRsp.isFailure()) {
      return Promise.reject(callRouterRsp);
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * set critical chain interaction log <br><br>
   *
   * @returns {promise<result>}
   *
   */
  setCriticalChainInteractionLog: async function () {

    const oThis = this
      , criticalChainInteractionLogs = await new CriticalChainInteractionLogModel().getByIds([
        oThis.criticalChainInteractionLogId,
        oThis.parentCriticalInteractionLogId
      ])
      , criticalChainInteractionLog = criticalChainInteractionLogs[oThis.criticalChainInteractionLogId]
      , parentCriticalChainInteractionLog = criticalChainInteractionLogs[oThis.parentCriticalInteractionLogId]
    ;

    if (!criticalChainInteractionLog) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'l_sam_a_3',
        api_error_identifier: 'no_data_found',
        debug_options: {error: error, clientId: oThis.clientId},
        error_config: errorConfig
      }));
    }

    if (!parentCriticalChainInteractionLog) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'l_sam_a_4',
        api_error_identifier: 'no_data_found',
        debug_options: {error: error, clientId: oThis.clientId},
        error_config: errorConfig
      }));
    }

    oThis.criticalChainInteractionLog = criticalChainInteractionLog;
    oThis.parentCriticalChainInteractionLog = parentCriticalChainInteractionLog;

    oThis.brandedTokenId = oThis.criticalChainInteractionLog.client_branded_token_id;
    oThis.clientId = oThis.criticalChainInteractionLog.client_id;
    oThis.clientTokenId = oThis.criticalChainInteractionLog.client_token_id;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Approve<br><br>
   *
   * @return {promise<result>}
   *
   */
  approve: async function () {
    const oThis = this
    ;

    // TODO:: use return_type in this.
    const approveForStakeServiceObj = new openSTPlatform.services.stake.approveForStake({
      options: {returnType: 'txReceipt'}
    });

    const approveResponse = await approveForStakeServiceObj.perform()
      , transactionReceipt = approveResponse.data.rawTransactionReceipt
    ;

    if (approveResponse.isFailure() || !transactionReceipt || !(transactionReceipt.status) ) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'l_sam_a_2',
        api_error_identifier: 'approve_failed',
        debug_options: approveResponse.toHash(),
        error_config: errorConfig
      }));
    }

    return Promise.resolve(responseHelper.successWithData({transactionHash: transactionReceipt.transactionHash }))
  },

  _criticalLogDebug: function(message, messageKind){
    const oThis = this;
    let parentId = oThis.parentCriticalInteractionLogId || '-';
    logger[messageKind].apply(logger, ["[p" + parentId + "][s" + oThis.criticalChainInteractionLogId + "]", message]);
  }
};

module.exports = ApproveKlass;