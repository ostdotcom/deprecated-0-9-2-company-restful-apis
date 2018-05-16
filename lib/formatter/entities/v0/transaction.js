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
        , formattedTransaction = {}
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

    formattedTransaction.id = oThis.params.id;
    formattedTransaction.transaction_uuid = oThis.params.id;
    formattedTransaction.from_user_id = oThis.params.from_user_id;
    formattedTransaction.to_user_id = oThis.params.to_user_id;
    formattedTransaction.transaction_type_id = oThis.params.action_id;
    formattedTransaction.transaction_hash = oThis.params.transaction_hash;

    formattedTransaction.status = oThis.params.status;
    formattedTransaction.gas_price = oThis.params.gas_price;
    formattedTransaction.transaction_timestamp = oThis.params.timestamp;
    formattedTransaction.uts = oThis.params.timestamp;
    formattedTransaction.gas_used = oThis.params.gas_used;
    formattedTransaction.transaction_fee = oThis.params.transaction_fee;
    formattedTransaction.block_number = oThis.params.block_number;
    formattedTransaction.bt_transfer_value = oThis.params.amount;
    formattedTransaction.bt_commission_amount = oThis.params.commission_amount;

    return responseHelper.successWithData(formattedTransaction);

  }

};

module.exports = TransactionFormatterKlass;