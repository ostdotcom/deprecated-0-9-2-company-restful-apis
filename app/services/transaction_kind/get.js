"use strict";

/**
 *
 * Return existing action
 *
 * @module app/services/transaction_kind/get
 */


var rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , ActionEntityFormatterKlass = require(rootPrefix +'/lib/formatter/entities/latest/action')
;

/**
 * Get an action
 *
 * @param params
 * @param {number} - params.client_id - client_id for action fetch
 * @param {number} - params.id - id of the action to fetch
 *
 * @constructor
 */
const GetAction = function(params){

  const oThis = this
  ;

  oThis.id = params.id;
  oThis.clientId = params.client_id;
  oThis.transactionTypes = [];

};

GetAction.prototype = {

  /**
   * perform
   *
   * @returns {promise}
   */
  perform: function() {
    const oThis = this
    ;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error({
            internal_error_identifier: 's_tk_g_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      })
  },

  /**
   * asyncPerform
   *
   * @returns {promise}
   */
  asyncPerform: async function() {
    const oThis = this
    ;

    await oThis.validateAssignParams();

    await oThis.getTransactionKind();

    return oThis.returnResponse();

  },

  /**
   * validateAssignParams - Perform validations on input params and assign for use
   *
   * @returns {promise}
   */
  validateAssignParams: async function() {
    const oThis = this
    ;

    if(isNaN(oThis.id)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_tk_g_1',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    return Promise.resolve({});
  },

  /**
   * getTransactionKind - Get the transaction kind record from DB
   *
   * @returns {promise}
   */
  getTransactionKind: async function () {
    const oThis = this
    ;

    const result = await new ClientTransactionTypeModel().getTransactionById({ clientTransactionId: oThis.id });

    oThis.result = result[0];

    if (!oThis.result) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_tk_g_2',
        api_error_identifier: 'data_not_found',
        debug_options: {clientId: oThis.clientId}
      }));
    }

    if(result.currency_type == clientTxTypesConst.btCurrencyType) {
      oThis.amount = basicHelper.formatWeiToString(basicHelper.convertToNormal(oThis.result.value_in_bt_wei));
    }else{
      oThis.amount = oThis.result.value_in_usd;
    }

    oThis.arbitrary_amount = oThis.amount ? false : true;
    oThis.arbitrary_commission = oThis.result.commission_percent ? false : true;

    return Promise.resolve({});
  },

  /**
   * returnResponse - format and return the response
   *
   * @returns {promise}
   */
  returnResponse: async function () {

    const oThis = this;

    let actionEntityFormatter = new ActionEntityFormatterKlass({
      id: oThis.result.id,
      client_id: oThis.clientId,
      name: oThis.result.name,
      kind: new ClientTransactionTypeModel().kinds[oThis.result.kind],
      currency: new ClientTransactionTypeModel().currencyTypes[oThis.result.currency_type],
      arbitrary_amount: oThis.arbitrary_amount,
      amount: oThis.amount,
      arbitrary_commission: oThis.arbitrary_commission,
      commission_percent: (oThis.result.commission_percent || '').toString(10),
      uts: Date.now()
    });

    let actionEntityFormatterRsp = await actionEntityFormatter.perform();

    return Promise.resolve(responseHelper.successWithData(
      {
        result_type: 'action',
        action: actionEntityFormatterRsp.data
      }
    ));
  }
};

module.exports = GetAction;
