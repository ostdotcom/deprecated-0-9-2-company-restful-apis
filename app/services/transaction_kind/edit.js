"use strict";

/**
 *
 * Edit existing action.
 *
 * @module app/services/transaction_kind/edit
 */

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , util = require(rootPrefix + '/lib/util')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ClientTransactionTypeFromNameCache = require(rootPrefix + '/lib/cache_management/client_transaction_type/by_name')
  , ClientTransactionTypeFromIdCache = require(rootPrefix + '/lib/cache_management/client_transaction_type/by_id')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
  , ActionEntityFormatterKlass = require(rootPrefix +'/lib/formatter/entities/latest/action')
;

/**
 * Edit action constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.id - client id for whom setup is to be made.
 * @param {string} params.name (optional)- name of the action, unique
 * @param {string} params.currency- (optional) Currency. "USD" (fixed), or "BT" (floating)
 * @param {string<float>} params.amount - (optional) Amount, "USD" (min USD 0.01), or "BT" (min BT 0.00001)
 * @param {boolean} params.arbitrary_amount - (mandatory) true/false
 * @param {boolean} params.arbitrary_commission - (mandatory) true/false
 * @param {string<float>} params.commission_percent - (optional) Only for "user_to_user" kind. (min 0%, max 100%).
 *
 * @constructor
 *
 */
const EditAction = function(params){
  const oThis = this
  ;

  oThis.id = params.id;
  oThis.client_id = params.client_id;
  oThis.name = params.name;
  oThis.currency = params.currency;
  oThis.arbitrary_amount = params.arbitrary_amount;
  oThis.amount = params.amount;
  oThis.arbitrary_commission = params.arbitrary_commission;
  oThis.commission_percent = params.commission_percent;

  this.transactionKindObj = {};

};

EditAction.prototype = {

  /**
   * perform
   *
   * @returns {promise}
   */
  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 'tk_e_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  /**
   * perform<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  asyncPerform: async function () {

    var oThis = this
      , r = null;

    r = await oThis.validateParams();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.editTransactionKind();
    if(r.isFailure()) return Promise.resolve(r);

    return await oThis.returnResponse();
  },

  /**
   * Validate params
   *
   * @sets transactionKindObj
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  validateParams: async function() {
    const oThis = this
    ;

    oThis.clientTransactionId = oThis.id;

    let qResult = await oThis.getCurrentTransactionKind();

    oThis.currentTransactionKind = qResult[0];

    if(!oThis.currentTransactionKind || oThis.currentTransactionKind.length==0){
      errors_object.push('invalid_client_transaction_id');
    }

    if(oThis.currentTransactionKind && oThis.currentTransactionKind['client_id'] != oThis.client_id) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'tk_e_1',
        api_error_identifier: 'unauthorized_for_other_client',
        debug_options: {}
      }));
    }

    let kind = new ClientTransactionTypeModel().kinds[oThis.currentTransactionKind.kind.toString()]
      , currency = (oThis.currency
          || new ClientTransactionTypeModel().currencyTypes[oThis.currentTransactionKind.currency_type]).toUpperCase()
      , amount = oThis.amount || oThis.currentTransactionKind.value_in_usd
          || basicHelper.convertToNormal(oThis.currentTransactionKind.value_in_bt_wei)
      , commission_percent = oThis.commission_percent || oThis.currentTransactionKind.commission_percent
      , errors_object = []
    ;

    amount = parseFloat(amount);
    commission_percent = parseFloat(commission_percent);

    /* Keep amount and currency type aligned in DB */
    if ( currency == clientTxTypesConst.usdCurrencyType) {

      if( !commonValidator.validateArbitraryAmount(amount, oThis.arbitrary_amount) ) {
        errors_object.push('invalid_amount_arbitrary_combination');
      } else if ( !commonValidator.validateUsdAmount(amount)) {
        errors_object.push('out_of_bound_transaction_usd_value');
      }

      oThis.transactionKindObj['currency_type'] = new ClientTransactionTypeModel().invertedCurrencyTypes[currency];
      oThis.transactionKindObj['value_in_bt_wei'] = null;
      oThis.transactionKindObj['value_in_usd'] = amount;

    } else if ( currency == clientTxTypesConst.btCurrencyType) {

      if(!commonValidator.validateArbitraryAmount(amount, oThis.arbitrary_amount) ) {
        errors_object.push('invalid_amount_arbitrary_combination');
      } else if ( !commonValidator.validateUsdAmount(amount) ) { // This validation has to be in USD, since, value is modified
        errors_object.push('out_of_bound_transaction_bt_value');
      }

      if (!commonValidator.isVarNull(amount)) {
        var value_in_bt_wei = basicHelper.convertToWei(amount);

        if(!basicHelper.isWeiValid(value_in_bt_wei)) {
          errors_object.push('out_of_bound_transaction_bt_value');
        }
        oThis.transactionKindObj['value_in_bt_wei'] = basicHelper.formatWeiToString(value_in_bt_wei);
      }

      oThis.transactionKindObj['currency_type'] = new ClientTransactionTypeModel().invertedCurrencyTypes[currency];
      oThis.transactionKindObj['value_in_usd'] = null;

    } else {
      errors_object.push('invalid_currency');
    }

    /* Validate commission percent */
    if( !commonValidator.validateArbitraryCommissionPercent(commission_percent, oThis.arbitrary_commission) ) {
      errors_object.push('invalid_commission_arbitrary_combination');
    }
    else if( !commonValidator.commissionPercentValid(commission_percent)) {
      errors_object.push('invalid_commission_percent');
    }

    if(commission_percent > 0 && kind != clientTxTypesConst.userToUserKind) {
      errors_object.push('invalid_commission_percent');
    }

    /* Validate name */
    if (oThis.name) {
      oThis.name = oThis.name.trim();
    }

    if(oThis.name && oThis.currentTransactionKind && oThis.currentTransactionKind['name'].toLowerCase() != oThis.name.toLowerCase()) {

      if(!basicHelper.isTxKindNameValid(oThis.name)){
        errors_object.push('invalid_transactionname');
      } else if (basicHelper.hasStopWords(oThis.name)) {
        errors_object.push('inappropriate_transactionname');
      } else {
        let existingTKind = await new ClientTransactionTypeModel()
            .getTransactionByName({
              client_id: oThis.currentTransactionKind['client_id'],
              name: oThis.name
            });

        if(existingTKind.length > 0 && oThis.id != existingTKind.id){
          errors_object['name'] = "Transaction kind name '"+ oThis.name +"' already present.";
        }
      }
    }

    /* Return all the validation errors */
    if(errors_object.length > 0) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 'tk_e_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: errors_object,
        debug_options: {}
      }));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Get existing action record<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  getCurrentTransactionKind: function(){
    var oThis = this;
    return new ClientTransactionTypeModel().getTransactionById({ clientTransactionId: oThis.id });
  },

  /**
   * edit action in DB.<br><br>
   *
   * @set transactionKindObj
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  editTransactionKind: async function() {
    const oThis = this
    ;

    if(oThis.name) oThis.transactionKindObj['name'] = oThis.name;

    if(oThis.commission_percent) oThis.transactionKindObj['commission_percent'] = oThis.commission_percent;

    await new ClientTransactionTypeModel().update(
      util.clone(oThis.transactionKindObj)
    ).where({id: oThis.clientTransactionId}).fire();


    new ClientTransactionTypeFromNameCache({client_id: oThis.currentTransactionKind['client_id'],
      transaction_kind: oThis.currentTransactionKind['name']}).clear();

    new ClientTransactionTypeFromIdCache({id: oThis.clientTransactionId}).clear();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Return response.<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  returnResponse: async function() {
    const oThis = this
    ;

    let currency_type = oThis.transactionKindObj.currency_type || oThis.currentTransactionKind.currency_type;

    let actionEntityFormatter = new ActionEntityFormatterKlass({
      id: oThis.id,
      client_id: oThis.currentTransactionKind.client_id,
      name: oThis.name || oThis.currentTransactionKind.name,
      currency: new ClientTransactionTypeModel().currencyTypes[currency_type],
      arbitrary_amount: oThis.arbitrary_amount,
      amount: oThis.amount,
      arbitrary_commission: oThis.arbitrary_commission,
      commission_percent: oThis.commission_percent || oThis.currentTransactionKind.commission_percent,
      uts: Date.now()
    });

    let actionEntityFormatterRsp = await actionEntityFormatter.perform();

    return Promise.resolve(responseHelper.successWithData(
      {
        result_type: "action",
        action: actionEntityFormatterRsp.data
      }
    ));
  }

};

module.exports = EditAction;
