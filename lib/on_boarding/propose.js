"use strict";

/**
 * Propose branded token
 *
 * @module lib/on_boarding/propose
 */

const openSTPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = '../..'
  , EditTokenKlass = require(rootPrefix + '/app/services/token_management/edit')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
  , OnBoardingRouter = require(rootPrefix + '/lib/on_boarding/router')
  , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

// time interval
const timeInterval = 30000 // 30 seconds
;

/**
 * propose branded token status
 *
 * @constructor
 *
 * @param {object} params - parameters object
 * @param {string} params.name - Branded token name
 * @param {string} params.symbol - Branded token symbol
 * @param {string} params.conversion_factor - Conversion factor (1 OST = ? Branded token)
 *
 */
const ProposeKlass = function (params) {

  const oThis = this
  ;

  oThis.criticalChainInteractionLogId = params.critical_interaction_log_id;

  oThis.criticalChainInteractionLog = null;
  oThis.symbol = null;
  oThis.name = null;
  oThis.conversionFactor = null;
  oThis.transactionHash = null;

};

ProposeKlass.prototype = {

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

        var errorObj = null;

        if(responseHelper.isCustomResult(error)) {
          errorObj = error;
        } else {
          // something unhandled happened
          logger.error('lib/on_boarding/propose.js::perform::catch');
          logger.error(error);

          errorObj = responseHelper.error("l_ob_p_1", "Inside catch block", null, {error: error}, {sendErrorEmail: true});

        }

        if (oThis.criticalChainInteractionLog) {
          const criticalChainInteractionLogObj = new CriticalChainInteractionLogModel()
          oThis.updateCriticalChainInteractionLog({
            status: criticalChainInteractionLogObj.invertedStatuses[criticalChainInteractionLogConst.failedStatus],
            response_data: errorObj.toHash()
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

    var r = await oThis.setCriticalChainInteractionLog();
    if(r.isFailure()) return r;

    var r = await oThis.setDerivedParams();
    if(r.isFailure()) return r;

    const proposeResponse = await oThis.propose();
    if (proposeResponse.isFailure()) {
      return proposeResponse;
    }

    const getRegistrationStatusResponse = await oThis.getRegistrationStatus();
    if(getRegistrationStatusResponse.isFailure()) return getRegistrationStatusResponse;

    const registerationData = getRegistrationStatusResponse.data.registration_status;

    const editTokenParams = {
          symbol: oThis.symbol,
          client_id: oThis.criticalChainInteractionLog.client_id,
          token_erc20_address: registerationData.erc20_address,
          token_uuid: registerationData.uuid}
      , editTokenObj = new EditTokenKlass(editTokenParams)
      , editTokenRsp = await editTokenObj.perform();

    await new OnBoardingRouter({
      current_step: 'propose',
      status: 'done',

      token_symbol: oThis.symbol,
      client_id: oThis.criticalChainInteractionLog.client_id,
      client_token_id: oThis.criticalChainInteractionLog.client_token_id,
      parent_critical_interaction_log_id: oThis.criticalChainInteractionLog.id,
      client_branded_token_id: oThis.criticalChainInteractionLog.client_branded_token_id,
      parent_activity_type: ''
    }).perform();

    return Promise.resolve(editTokenRsp);

  },

  /**
   * set critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  setCriticalChainInteractionLog: async function () {

    const oThis = this
        , criticalChainInteractionLogObj = new CriticalChainInteractionLogModel()
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
   * set params which could be derived from ciritcal log table <br><br>
   *
   * @return {promise<result>}
   *
   */
  setDerivedParams: async function () {

    const oThis = this;

    const clientBrandedTokenRecords = await new ClientBrandedTokenModel().select('name,symbol,conversion_factor').where(['id=?', oThis.criticalChainInteractionLog.client_branded_token_id]).fire();
    const clientBrandedToken = clientBrandedTokenRecords[0];

    if(!clientBrandedToken){
      return Promise.reject(responseHelper.error('l_snm_p_3', 'no client branded token found for id'+oThis.criticalChainInteractionLog.client_branded_token_id, null,
          {}, {sendErrorEmail: false}));
    }

    if(!clientBrandedToken.symbol || !clientBrandedToken.name || !clientBrandedToken.conversion_factor){
      return Promise.reject(responseHelper.error('l_snm_p_4', 'clientBrandedToken not setup well', {clientBrandedToken: clientBrandedToken},
          {}, {sendErrorEmail: false}));
    }

    oThis.symbol = clientBrandedToken.symbol;
    oThis.name = clientBrandedToken.name;
    oThis.conversionFactor = clientBrandedToken.conversion_factor;

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * update critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  updateCriticalChainInteractionLog: async function (dataToUpdate) {

    const oThis = this
        , criticalChainInteractionLogObj = new CriticalChainInteractionLogModel();

    if (!dataToUpdate.response_data) {
      dataToUpdate.response_data = '{}';
    } else {
      dataToUpdate.response_data = JSON.stringify(dataToUpdate.response_data);
    }

    await criticalChainInteractionLogObj.update(dataToUpdate).where({id: oThis.criticalChainInteractionLog.id}).fire();

    criticalChainInteractionLogObj.flushTxStatusDetailsCache(oThis.criticalChainInteractionLogId);

    criticalChainInteractionLogObj.flushPendingTxsCache(oThis.criticalChainInteractionLog.client_token_id);

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Propose<br><br>
   *
   * @return {promise<result>}
   *
   */
  propose: async function () {

    const oThis = this
        , criticalChainInteractionLogObj = new CriticalChainInteractionLogModel()
    ;

    const proposeServiceObj = new openSTPlatform.services.onBoarding.proposeBrandedToken({
      symbol: oThis.symbol,
      name: oThis.name,
      conversion_factor: oThis.conversionFactor
    });

    const proposeResponse = await proposeServiceObj.perform();

    if (proposeResponse.isFailure()) {

      oThis.updateCriticalChainInteractionLog({
        status: criticalChainInteractionLogObj.invertedStatuses[criticalChainInteractionLogConst.failedStatus],
        response_data: {err: proposeResponse.err || {}, data: proposeResponse.data || {}}
      });

    } else {

      oThis.updateCriticalChainInteractionLog({
        status: criticalChainInteractionLogObj.invertedStatuses[criticalChainInteractionLogConst.pendingStatus],
        transaction_uuid: proposeResponse.data.transaction_uuid,
        transaction_hash: proposeResponse.data.transaction_hash
      });

      oThis.transactionHash = proposeResponse.data.transaction_hash;

    }

    return proposeResponse;

  },

  /**
   * Get registration status<br><br>
   *
   * @return {result} - returns an object of Result
   *
   */
  getRegistrationStatus: function () {
    return new Promise(function(onResolve, onReject) {
      // number of times it will attempt to fetch
      var maxAttempts = 25;

      const getStatus = async function() {
        if (maxAttempts > 0) {
          const getRegistrationStatusServiceObj = new openSTPlatform.services.onBoarding.getRegistrationStatus({
            transaction_hash: oThis.transactionHash
          });

          const getRegistrationStatusResponse = await getRegistrationStatusServiceObj.perform();

          if(getRegistrationStatusResponse.isSuccess()
            && getRegistrationStatusResponse.data
            && getRegistrationStatusResponse.data.registration_status.is_proposal_done === 1
            && getRegistrationStatusResponse.data.registration_status.is_registered_on_uc === 1
            && getRegistrationStatusResponse.data.registration_status.is_registered_on_vc === 1
          ) {

            oThis.updateCriticalChainInteractionLog({
              status: criticalChainInteractionLogObj.invertedStatuses[criticalChainInteractionLogConst.processedStatus],
              response_data: {err: getRegistrationStatusResponse.err || {}, data: getRegistrationStatusResponse.data || {}}
            });

            onResolve(getRegistrationStatusResponse);

          } else {

            oThis.updateCriticalChainInteractionLog({
              status: criticalChainInteractionLogObj.invertedStatuses[criticalChainInteractionLogConst.pendingStatus],
              response_data: {err: getRegistrationStatusResponse.err || {}, data: getRegistrationStatusResponse.data || {}}
            });

            maxAttempts--;

            setTimeout(getStatus, timeInterval);

          }

        } else {

          oThis.updateCriticalChainInteractionLog({
            status: criticalChainInteractionLogObj.invertedStatuses[criticalChainInteractionLogConst.timeoutStatus],
            response_data: {err: getRegistrationStatusResponse.err || {}, data: getRegistrationStatusResponse.data || {}}
          });

          return onReject(responseHelper.error("l_ob_p_2", 'Unable to get registration status. Max attempts exceeded.'));

        }

      };

      setTimeout(getStatus, timeInterval);

    });
  }
};

module.exports = ProposeKlass;
