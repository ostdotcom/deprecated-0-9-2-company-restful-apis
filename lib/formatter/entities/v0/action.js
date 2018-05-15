"use strict";

/**
 * NOTE: This formatter will always format data as per latest version
 * Action Entity Formatter.
 *
 * @module lib/formatter/entities/action
 */

const rootPrefix = "../../../.."
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , basicHelper = require(rootPrefix + '/helpers/basic')
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
    const oThis = this
      , mandatoryRootLevelKeys = ['id', 'name', 'kind', 'currency']
      , formattedAction = {}
    ;

    for(var i = 0; i < mandatoryRootLevelKeys.length; i ++) {
      if(!oThis.params.hasOwnProperty(mandatoryRootLevelKeys[i])) {
        return Promise.reject(responseHelper.error({
          internal_error_identifier: 'l_f_e_l_a_1',
          api_error_identifier: 'entity_formatting_failed',
          debug_options: oThis.params
        }));
      }
    }

    var amount = null;

    if(oThis.params.kind == clientTxTypesConst.usdCurrencyType && !commonValidator.isVarNull(oThis.params.value_in_usd)){
      amount = oThis.params.value_in_usd;
    } else if (oThis.params.kind == clientTxTypesConst.btCurrencyType && !commonValidator.isVarNull(oThis.params.value_in_bt_wei)) {
      amount = basicHelper.convertToNormal(oThis.params.value_in_bt_wei);
    }

    formattedAction.id = oThis.params.id;
    formattedAction.client_transaction_id = formattedAction.id;
    formattedAction.name = oThis.params.name;
    formattedAction.kind = oThis.params.kind;
    formattedAction.currency_type = oThis.params.currency;
    formattedAction.currency_value = amount;
    formattedAction.commission_percent = oThis.params.commission_percent;
    formattedAction.uts = Date.now();

    return Promise.resolve(responseHelper.successWithData(formattedAction));

  }
};

module.exports = ActionFormatterKlass;