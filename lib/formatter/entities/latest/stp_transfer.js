"use strict";

/**
 * NOTE: This formatter will always format data as per latest version
 * Transaction Entity Formatter.
 *
 * @module lib/formatter/entities/latest/transaction
 */

const rootPrefix = "../../../.."
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , transactionLogModel = require(rootPrefix + '/app/models/transaction_log')
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
const StpTransferFormatterKlass = function(params){
  const oThis = this
  ;

  oThis.params = params;
};

StpTransferFormatterKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function () {

    const oThis = this
      , mandatoryRootLevelKeys = ['status', 'gas_price', 'input_params']
      , mandatoryInputParamKeys = ['from_address', 'to_address']
      , formattedTransaction = {}
    ;

    for(var i = 0; i < mandatoryRootLevelKeys.length; i ++) {
      if(!oThis.params.hasOwnProperty(mandatoryRootLevelKeys[i])) {
        return Promise.reject(responseHelper.error({
          internal_error_identifier: 'l_f_e_l_stpt_1',
          api_error_identifier: 'entity_formatting_failed',
          debug_options: oThis.params
        }));
      }
    }

    oThis.params.input_params = oThis.params.input_params || {};
    for(var i = 0; i < mandatoryInputParamKeys.length; i ++) {
      if(!oThis.params.input_params.hasOwnProperty(mandatoryInputParamKeys[i])) {
        return Promise.reject(responseHelper.error({
          internal_error_identifier: 'l_f_e_l_stpt_2',
          api_error_identifier: 'entity_formatting_failed',
          debug_options: oThis.params
        }));
      }
    }

    formattedTransaction.id = oThis.params.transaction_uuid;
    formattedTransaction.from_address = oThis.params.input_params.from_address;
    formattedTransaction.to_address = oThis.params.input_params.to_address;
    formattedTransaction.amount = oThis.params.input_params.amount_in_wei;
    formattedTransaction.transaction_hash = oThis.params.transaction_hash;
    formattedTransaction.timestamp = new Date(oThis.params.updated_at).getTime();
    formattedTransaction.status = new transactionLogModel().statuses[oThis.params.status];
    formattedTransaction.gas_price = oThis.params.gas_price;

    if (oThis.params.block_number) {
      formattedTransaction.gas_used = oThis.params.gas_used;
      formattedTransaction.block_number = oThis.params.block_number;
    }

    return responseHelper.successWithData(formattedTransaction);

  }

};

module.exports = StpTransferFormatterKlass;