"use strict";

/**
 * NOTE: This formatter will always format data as per latest version
 * Balance Entity Formatter.
 *
 * @module lib/formatter/entities/latest/balance
 */

const rootPrefix = "../../../.."
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

/**
 *
 * @constructor
 *
 * @param {object} params - this is object with keys.
 * @param {string} params.totalAirdroppedTokens
 * @param {string} params.unsettledDebits
 * @param {string} params.settledBalance
 * @param {string} params.availableBalance - mandatory
 * @param {string} params.balanceAirdropAmount - mandatory
 * @param {string} params.tokenBalance - mandatory
 */
const BalanceFormatterKlass = function(params) {

  const oThis = this
  ;

  oThis.params = params;

};

BalanceFormatterKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function () {

    const oThis = this
      , mandatoryRootLevelKeys = ['availableBalance', 'balanceAirdropAmount', 'tokenBalance']
      , formattedBalance = {}
    ;

    for(var i = 0; i < mandatoryRootLevelKeys.length; i ++) {
      if(!oThis.params.hasOwnProperty(mandatoryRootLevelKeys[i])) {
        return Promise.reject(responseHelper.error({
          internal_error_identifier: 'l_f_e_l_balance_1',
          api_error_identifier: 'entity_formatting_failed',
          debug_options: oThis.params
        }));
      }
    }

    formattedBalance.available_balance = basicHelper.convertToNormal(oThis.params.tokenBalance);
    formattedBalance.airdropped_balance = basicHelper.convertToNormal(oThis.params.balanceAirdropAmount);
    formattedBalance.token_balance = basicHelper.convertToNormal(oThis.params.availableBalance);

    return responseHelper.successWithData(formattedBalance);

  }

};

module.exports = BalanceFormatterKlass;