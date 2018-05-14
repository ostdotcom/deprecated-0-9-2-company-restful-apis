"use strict";

/**
 * NOTE: This formatter will always format data as per latest version
 * Action Entity Formatter.
 *
 * @module lib/formatter/entities/action
 */

const rootPrefix = "../../../.."
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * ActionFormatterKlass
 * @param params - this is object with keys
 * @param {Integer} params.id - client transaction kind id
 * @param {String} params.name - name
 * @param {String} params.kind - transaction kind
 * @param {String} params.currency - type of currency USD/BT
 * @param {Float} params.amount - value of the chosen currency
 * @param {Float} params.commission_percent - commission percent to be used
 *
 * @constructor
 */
const ActionFormatterKlass = function (params) {
  const oThis = this;

  oThis.params = params;
};

ActionFormatterKlass.prototype = {

  perform: async function () {
    const oThis = this;

    let formattedAction = {};

    if (!oThis.params.hasOwnProperty('id')
      || !oThis.params.hasOwnProperty('name') || !oThis.params.hasOwnProperty('kind')
      || !oThis.params.hasOwnProperty('currency') || !oThis.params.hasOwnProperty('amount')
      || !oThis.params.hasOwnProperty('commission_percent')
      || !oThis.params.hasOwnProperty('uts')) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'l_f_e_v0_a_1',
        api_error_identifier: 'entity_formatting_failed',
        debug_options: oThis.params
      }));
    }

    formattedAction.id = oThis.params.id;
    formattedAction.client_transaction_id = formattedAction.id;
    formattedAction.name = oThis.params.name;
    formattedAction.kind = oThis.params.kind;
    formattedAction.currency_type = oThis.params.currency;
    formattedAction.currency_value = oThis.params.amount;
    formattedAction.commission_percent = oThis.params.commission_percent;
    formattedAction.uts = oThis.params.uts;

    return Promise.resolve(responseHelper.successWithData(formattedAction));

  }
};

module.exports = ActionFormatterKlass;