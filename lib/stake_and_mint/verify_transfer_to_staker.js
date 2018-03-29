"use strict";

const rootPrefix = "../.."
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log.js')
  , GetReceiptKlass = require(rootPrefix + '/app/services/transaction/get_receipt.js')
  , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

const VerifyTransferToStakerKlass = function(params){
  const oThis = this
  ;

  oThis.criticalChainInteractionLogId = params.critical_interaction_log_id;
  // if stake and mint is called directly, parent_critical_interaction_log_id will be null. In this case, set self to parent.
  oThis.parentCriticalInteractionLogId = params.parent_critical_interaction_log_id || params.critical_interaction_log_id;

  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;
  oThis.brandedTokenId = null;
  oThis.clientId = null;
  oThis.clientTokenId = null;
  oThis.brandedToken = null;

  oThis.transactionHash = null;
  oThis.stPrimeToMint = null;
};

VerifyTransferToStakerKlass.prototype = {

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

        if(responseHelper.isCustomResult(error)) {
          errorObj = error;
        } else {
          // something unhandled happened
          logger.error('lib/stake_and_mint/verify_transfer_to_staker.js::perform::catch');
          logger.error(error);

          errorObj = responseHelper.error("l_sam_vtts_1", "Inside catch block", null, {error: error},
            {sendErrorEmail: true});
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
          ).catch(function(err){
            logger.error('lib/stake_and_mint/verify_transfer_to_staker.js::perform::catch::updateCriticalChainInteractionLog');
            logger.error(error);
          });
        }

        return errorObj;
      });
  },

  /**
   * asyncPerform
   *
   * @returns {promise<result>}
   */

  asyncPerform: async function() {
    const oThis = this
    ;

    await oThis.setCriticalChainInteractionLog();

    await oThis.setDerivedParams();

    const getReceiptResponse = await oThis.getReceipt();

    await oThis.validateReceipt(getReceiptResponse.data);

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
      return Promise.reject(responseHelper.error("l_sam_vtts_2", "criticalChainInteractionLog not found", null, {},
        {sendErrorEmail: false}));
    }

    if (!parentCriticalChainInteractionLog) {
      return Promise.reject(responseHelper.error("l_sam_vtts_3", "parentCriticalChainInteractionLog not found", null, {},
        {sendErrorEmail: false}));
    }

    oThis.criticalChainInteractionLog = criticalChainInteractionLog;
    oThis.parentCriticalChainInteractionLog = parentCriticalChainInteractionLog;

    oThis.brandedTokenId = oThis.criticalChainInteractionLog.client_branded_token_id;
    oThis.clientId = oThis.criticalChainInteractionLog.client_id;
    oThis.clientTokenId = oThis.criticalChainInteractionLog.client_token_id;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * set params which could be derived from ciritcal log table <br><br>
   *
   * @returns {promise<result>}
   *
   */
  setDerivedParams: function () {

    const oThis = this
    ;

    oThis.transactionHash = oThis.criticalChainInteractionLog.transaction_hash;
    oThis.stPrimeToMint = oThis.criticalChainInteractionLog.request_params.stake_and_mint_params.st_prime_to_mint;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * get Receipt
   *
   * @returns {promise<result>}
   */
  getReceipt: async function () {
    const oThis = this
    ;

    return new Promise(function(onResolve, onReject) {
      let max_retry_count = 25;
      let timeInterval = 30000;

      const getReceiptAttempt = function() {
        max_retry_count--;

        if (max_retry_count > 0){
          const getReceiptResponse = await new GetReceiptKlass({
            transaction_hash: oThis.transactionHash,
            chain: criticalChainInteractionLogConst.valueChainType
          }).perform();

          if (getReceiptResponse.isFailure() || !getReceiptResponse.data) {
            setTimeout(getReceiptAttempt, timeInterval);
          }
          return onResolve(getReceiptResponse);
        } else {
          return onReject(responseHelper.error("l_sam_vtts_6", "Receipt not successful after maximum retries", null, {},
            {sendErrorEmail: false}));
        }
      };

      setTimeout(getReceiptAttempt, timeInterval);
    });
  },

  /**
   * validateReceipt
   *
   * @param tx_receipt_data
   *
   * @returns {promise<result>}
   */
  validateReceipt: async function(tx_receipt_data){
    const oThis = this
    ;

    let rawReceipt = tx_receipt_data.rawTransactionReceipt;
    let client_eth_address = oThis.criticalChainInteractionLog.request_params.client_eth_address.toLowerCase();

    if (client_eth_address != rawReceipt.from){
      return Promise.reject(responseHelper.error("l_sam_vts_5", "Invalid From Address", null, {error: error},
        {sendErrorEmail: true}));
    }

    if (rawReceipt.to.toLowerCase() != chainInteractionConstants.SIMPLE_TOKEN_CONTRACT_ADDR.toLowerCase()){
      return Promise.reject(responseHelper.error("l_sam_vts_3", "Invalid To Address", null, {error: error},
        {sendErrorEmail: true}));
    }

    let formatted_receipt = rawReceipt.formattedTransactionReceipt;

    let buffer = formatted_receipt.eventsData[0].events
      .filter(function(event) {return event.name == '_to';});

    if (buffer[0]['value'].toLowerCase() != chainInteractionConstants.STAKER_ADDR.toLowerCase()){
      return Promise.reject(responseHelper.error("l_sam_vts_4", "Invalid transfer To Address", null, {error: error},
        {sendErrorEmail: true}));
    }

    buffer = formatted_receipt.eventsData[0].events
      .filter(function(event) {return event.name == '_value';});

    let transfered_ost = basicHelper.convertToNormal(buffer[0].value);
    let ost_to_stake_to_mint_bt = transfered_ost - oThis.stPrimeToMint;

    oThis.criticalChainInteractionLog.request_params.stake_and_mint_params.ost_to_stake_to_mint_bt = ost_to_stake_to_mint_bt;

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

module.exports = VerifyTransferToStakerKlass;