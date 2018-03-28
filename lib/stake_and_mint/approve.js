"use strict";

/**
 * Approve Staker Address's all amount to contract 
 *
 * @module lib/stake_and_mint/approve
 */

const openSTPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = '../..'
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

  oThis.parentCriticalChainInteractionLogId = params.parent_critical_chain_interaction_log_id;

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

            return responseHelper.error("l_snm_p_1", "Inside catch block", null, {}, {sendErrorEmail: false});
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

    const approveResponse = await oThis.approve();
    if (approveResponse.isFailure()) {
      return approveResponse;
    }

    const transactionReceipt = approveResponse.data.transactionReceipt;

    // TODO update in db

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

  },

};
