"use strict";

/**
 * Propose branded token
 *
 * @module lib/on_boarding/propose
 */

const openSTPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = '../..'
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

  oThis.symbol = params.symbol;
  oThis.name = params.name;
  oThis.conversionFactor = params.conversion_factor;
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
        if(responseHelper.isCustomResult(error)) {
          return error;
        } else {
          // something unhandled happened
          logger.error('lib/on_boarding/propose.js::perform::catch');
          logger.error(error);

          return responseHelper.error("l_ob_p_1", "Inside catch block", null, {}, {sendErrorEmail: false});
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

    const proposeResponse = await oThis.propose();
    if(proposeResponse.isFailure()) return proposeResponse;

    const transactionHash = proposeResponse.data.transaction_hash
      , transactionUuid = proposeResponse.data.transaction_uuid
    ;

    // TODO save in db

    const getRegistrationStatusResponse = await oThis.getRegistrationStatus(transactionHash);
    if(getRegistrationStatusResponse.isFailure()) return getRegistrationStatusResponse;


    const erc20Address = getRegistrationStatusResponse.data.erc20_address
      , uuid = getRegistrationStatusResponse.data.uuid
      , isProposalDone = getRegistrationStatusResponse.data.is_proposal_done
      , isRegisteredOnUc = getRegistrationStatusResponse.data.is_registered_on_uc
      , isRegisteredOnVc = getRegistrationStatusResponse.data.is_registered_on_vc
    ;

    // TODO save in db

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Propose<br><br>
   *
   * @return {promise<result>}
   *
   */
  propose: function () {
    const oThis = this
    ;

    const proposeServiceObj = new openSTPlatform.services.onBoarding.proposeBrandedToken({
      symbol: oThis.symbol,
      name: oThis.name,
      conversion_factor: oThis.conversionFactor
    });

    return proposeServiceObj.perform();
  },

  /**
   * Get registration status<br><br>
   *
   * @return {result} - returns an object of Result
   *
   */
  getRegistrationStatus: function (transactionHash) {
    return new Promise(function(onResolve, onReject) {
      // number of times it will attempt to fetch
      var maxAttempts = 25;

      const getStatus = async function() {
        if (maxAttempts > 0) {
          const getRegistrationStatusServiceObj = new openSTPlatform.services.onBoarding.getRegistrationStatus({
            transaction_hash: transactionHash
          });

          const getRegistrationStatusResponse = await getRegistrationStatusServiceObj.perform();

          if(getRegistrationStatusResponse.isSuccess()
            && getRegistrationStatusResponse.data
            && getRegistrationStatusResponse.data.is_proposal_done === 1
            && getRegistrationStatusResponse.data.is_registered_on_uc === 1
            && getRegistrationStatusResponse.data.is_registered_on_vc === 1
          ) {
            onResolve(getRegistrationStatusResponse)
          } else {
            maxAttempts--;

            setTimeout(getStatus, timeInterval);
          }

        } else {
          return onReject(responseHelper.error("l_ob_p_2", 'Unable to get registration status. Max attempts exceeded.'));
        }
      };

      setTimeout(getStatus, timeInterval);
    });
  }
};
