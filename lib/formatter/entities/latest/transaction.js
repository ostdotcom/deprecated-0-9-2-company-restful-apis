'use strict';

/**
 * NOTE: This formatter will always format data as per latest version
 * Transaction Entity Formatter.
 *
 * @module lib/formatter/entities/latest/transaction
 */

const rootPrefix = '../../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  basicHelper = require(rootPrefix + '/helpers/basic');

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
const TransactionFormatterKlass = function(params) {
  const oThis = this;

  oThis.params = params;
};

TransactionFormatterKlass.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function() {
    const oThis = this,
      mandatoryRootLevelKeys = ['updated_at', 'status', 'gas_price'],
      mandatoryInputParamKeys = ['from_uuid', 'to_uuid', 'action_id'],
      formattedTransaction = {};

    for (var i = 0; i < mandatoryRootLevelKeys.length; i++) {
      if (!oThis.params.hasOwnProperty(mandatoryRootLevelKeys[i])) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'l_f_e_l_t_1',
            api_error_identifier: 'entity_formatting_failed',
            debug_options: oThis.params
          })
        );
      }
    }

    for (var i = 0; i < mandatoryInputParamKeys.length; i++) {
      if (!oThis.params.hasOwnProperty(mandatoryInputParamKeys[i])) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'l_f_e_l_t_2',
            api_error_identifier: 'entity_formatting_failed',
            debug_options: oThis.params
          })
        );
      }
    }

    formattedTransaction.id = oThis.params.transaction_uuid;
    formattedTransaction.from_user_id = oThis.params.from_uuid;
    formattedTransaction.to_user_id = oThis.params.to_uuid;
    formattedTransaction.transaction_hash = oThis.params.transaction_hash || null;
    formattedTransaction.action_id = oThis.params.action_id;
    formattedTransaction.timestamp = new Date(oThis.params.updated_at).getTime();
    formattedTransaction.status = transactionLogConst.statuses[oThis.params.status];
    formattedTransaction.gas_price = oThis.params.gas_price;

    if (oThis.params.block_number) {
      formattedTransaction.gas_used = oThis.params.gas_used;

      let gasUsedBig = basicHelper.convertToBigNumber(oThis.params.gas_used),
        gasPriceBig = basicHelper.convertToBigNumber(oThis.params.gas_price),
        gasValue = gasUsedBig.mul(gasPriceBig);

      let amount = oThis.params.amount_in_wei ? basicHelper.convertToNormal(oThis.params.amount_in_wei) : null;

      let commission = oThis.params.commission_amount_in_wei
        ? basicHelper.convertToNormal(oThis.params.commission_amount_in_wei)
        : null;

      let airdropAmount = oThis.params.airdrop_amount_in_wei
        ? basicHelper.convertToNormal(oThis.params.airdrop_amount_in_wei)
        : null;

      formattedTransaction.transaction_fee = basicHelper.convertToNormal(gasValue).toString(10);
      formattedTransaction.block_number = oThis.params.block_number;
      formattedTransaction.amount = amount;
      formattedTransaction.commission_amount = commission;
      formattedTransaction.airdropped_amount = airdropAmount;
    } else {
      formattedTransaction.gas_used = null;
      formattedTransaction.transaction_fee = null;
      formattedTransaction.block_number = null;
      formattedTransaction.amount = null;
      formattedTransaction.commission_amount = null;
      formattedTransaction.airdropped_amount = null;
    }

    return responseHelper.successWithData(formattedTransaction);
  }
};

module.exports = TransactionFormatterKlass;
