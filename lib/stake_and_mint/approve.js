"use strict";

/**
 * Approve Staker Address's all amount to contract 
 *
 * @module lib/stake_and_mint/approve
 */

const openSTPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = '../..'
    , CriticalChainInteractionLogKlass = require(rootPrefix + '/app/models/critical_chain_interaction_log')
    , criticalChainInteractionLogObj = new CriticalChainInteractionLogKlass()
    , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * approve staker address's balance
 *
 * @constructor
 */
const ApproveKlass = function (params) {

  const oThis = this
  ;

  oThis.criticalChainInteractionLogId = params.critical_interaction_log_id;
  oThis.parentCriticalInteractionLogId = params.parent_critical_interaction_log_id;
  oThis.criticalChainInteractionLog = null;

};

ApproveKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function () {
    const oThis = this
    ;

    return oThis.asyncPerform()
        .catch(function (error) {

          if(responseHelper.isCustomResult(error)) {

            return error;

          } else {

            // something unhandled happened
            logger.error('lib/stake_and_mint/approve.js::perform::catch');
            logger.error(error);

            var errorRsp = responseHelper.error("l_snm_p_1", "Inside catch block", null, {error: error}, {sendErrorEmail: false});

            if (oThis.criticalChainInteractionLog) {
              oThis.updateCriticalChainInteractionLog({
                status: criticalChainInteractionLogObj.invertedStatuses[criticalChainInteractionLogConst.failedStatus],
                response_data: errorRsp.toHash
              });
            }

            return errorRsp;

          }

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

    var r = await setCriticalChainInteractionLog();
    if (r.isFailure()) {
      return r;
    }

    const approveResponse = await oThis.approve()
        , transactionReceipt = approveResponse.data.transactionReceipt;

    if (approveResponse.isFailure() || !transactionReceipt || parseInt(transactionReceipt.status, 16) !== 1) {
      oThis.updateCriticalChainInteractionLog({
        status: criticalChainInteractionLogObj.invertedStatuses[criticalChainInteractionLogConst.failedStatus],
        response_data: approveResponse.toHash
      });
      return approveResponse;
    }

    var response = responseHelper.successWithData({});
    oThis.updateCriticalChainInteractionLog({
        status: criticalChainInteractionLogObj.invertedStatuses[criticalChainInteractionLogConst.processedStatus],
        response_data: response.toHash
      });

    return Promise.resolve(response);

  },

  /**
   * set critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  setCriticalChainInteractionLog: async function () {

    const oThis = this
        , criticalChainInteractionLogs = await criticalChainInteractionLogObj.getByIds([oThis.criticalChainInteractionLogId])
        , criticalChainInteractionLog = criticalChainInteractionLogs[oThis.criticalChainInteractionLogId]
    ;

    if (!criticalChainInteractionLog) {
      return responseHelper.error("l_snm_p_2", "criticalChainInteractionLog not found", null, {}, {sendErrorEmail: false});
    }

    oThis.criticalChainInteractionLog = criticalChainInteractionLog;

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * update critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  updateCriticalChainInteractionLog: async function (dataToUpdate) {

    const oThis = this;

    dataToUpdate.updated_at = new Date();
    if (!dataToUpdate.response_data) {
      dataToUpdate.response_data = '{}';
    } else {
      dataToUpdate.response_data = JSON.stringify(dataToUpdate.response_data);
    }

    await criticalChainInteractionLogObj.update(dataToUpdate).where({id: oThis.criticalChainInteractionLog.id}).fire();

    criticalChainInteractionLogObj.flushTxStatusDetailsCache(oThis.criticalChainInteractionLog.insertId);

    criticalChainInteractionLogObj.flushPendingTxsCache(oThis.criticalChainInteractionLog.client_token_id);

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Approve<br><br>
   *
   * @return {promise<result>}
   *
   */
  approve: function () {
    const oThis = this
    ;

    const proposeServiceObj = new openSTPlatform.services.onBoarding.approveForStake({
      run_in_async: false
    });

    return proposeServiceObj.perform();

  }

};

module.exports = ApproveKlass;