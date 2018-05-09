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
 * @param {String} params.currency_type - type of currency USD/BT
 * @param {Float} params.currency_value - value of the chosen currency
 * @param {Float} params.commission_percent - commission percent to be used
 *
 * @constructor
 */
const ActionFormatterKlass = function(params){
  const oThis = this;

  oThis.params = params;
};

ActionFormatterKlass.prototype = {

  perform: async function(){
    const oThis = this;

    let formattedAction = {};

    if (!oThis.params.hasOwnProperty('id') || !oThis.params.hasOwnProperty('client_id') || !oThis.params.hasOwnProperty('name')
        || !oThis.params.hasOwnProperty('kind')
        || !oThis.params.hasOwnProperty('currency') || !oThis.params.hasOwnProperty('amount')
        || !oThis.params.hasOwnProperty('arbitrary_amount') || !oThis.params.hasOwnProperty('commission_percent')
        || !oThis.params.hasOwnProperty('arbitrary_commission')
        || !oThis.params.hasOwnProperty('uts') ){
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'l_f_e_l_a_1',
        api_error_identifier: 'entity_formatting_failed',
        debug_options: oThis.params
      }));
    }

    console.log("params", oThis.params);

    formattedAction.id = oThis.params.id;
    formattedAction.name = oThis.params.name;
    formattedAction.kind = oThis.params.kind;
    formattedAction.currency = oThis.params.currency;
    formattedAction.amount = oThis.params.amount;
    formattedAction.arbitrary_amount = oThis.params.arbitrary_amount;
    formattedAction.commission_percent = oThis.params.commission_percent;
    formattedAction.arbitrary_commission = oThis.params.arbitrary_commission;
    formattedAction.uts = oThis.params.uts;

    console.log("formattedAction", formattedAction);
    return Promise.resolve(responseHelper.successWithData(formattedAction));
  }

};

module.exports = ActionFormatterKlass;