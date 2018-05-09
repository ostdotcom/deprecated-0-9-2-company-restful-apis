"use strict";

/**
 * NOTE: This formatter will always format data as per latest version
 * Transaction Entity Formatter.
 *
 * @module lib/formatter/entities/transaction
 */

const rootPrefix = "../../../.."
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 *
 * @constructor
 *
 * @param {object} params - this is object with keys.
 * @param {string} params.id - transaction uuid
 * @param {string} params.from_user_id - transaction initiater uuid
 * @param {string} params.to_user_id - transaction receiver uuid
 * @param {string} params.action_id - action id
 */
const TransactionFormatterKlass = function(params){

  const oThis = this;

  oThis.params = params;

};

TransactionFormatterKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function () {

    const oThis = this
        , formattedUser = {}
    ;

    if (!oThis.params.hasOwnProperty('id') || !oThis.params.hasOwnProperty('from_user_id') ||
      !oThis.params.hasOwnProperty('to_user_id') || !oThis.params.hasOwnProperty('transaction_hash') ||
      !oThis.params.hasOwnProperty('action_id')) {

      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'l_f_e_v0_t_1',
        api_error_identifier: 'entity_formatting_failed',
        debug_options: oThis.params
      }));
    }

    formattedUser.transaction_uuid = oThis.params.id;
    formattedUser.from_uuid = oThis.params.from_user_id;
    formattedUser.to_uuid = oThis.params.to_user_id;
    formattedUser.transaction_hash = oThis.params.transaction_hash;
    formattedUser.action_id = oThis.params.action_id;

    return responseHelper.successWithData(formattedUser);

  }

};

module.exports = TransactionFormatterKlass;