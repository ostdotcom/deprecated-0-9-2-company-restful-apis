"use strict";

/**
 *
 * Edit existing ransaction kind.
 *
 * @module app/services/transaction_kind/edit
 */

var rootPrefix = '../../..'
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
 * Edit transaction kind constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.id - client id for whom setup is to be made.
 * @param {boolean} params.arbitrary_amount - true/false
 * @param {boolean} params.arbitrary_commission - true/false
 * @param {string} [params.name] - Name of the transaction kind eg. voteUp, voteDown, etc..
 * @param {string} [params.kind] - The kind of the kind, user_to_user, user_to_client, etc..
 * @param {string} [params.currency] - Currency. usd or bt
 * @param {decimal} [params.amount] - Value of currency with respect to currency
 * @param {decimal} [params.commission_percent] - commission in percentage.
 *
 * @constructor
 *
 */
const Edit = function(params){

  this.params = params || {};
  this.transactionKindObj = {};

  console.log("params", params);

};

Edit.prototype = {

  constructor: Edit,

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
   * Validate params<br><br>
   *
   * @sets transactionKindObj
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  validateParams: async function(){
    var oThis = this
      , id = oThis.params.id
      , client_id = oThis.params.client_id
    ;

    oThis.clientTransactionId = id;

    var qResult = await oThis.getCurrentTransactionKind();
    oThis.currentTransactionKind = qResult[0];

    console.log("currentTransactionKind", oThis.currentTransactionKind);

    var name = oThis.params.name || oThis.currentTransactionKind.name
      , kind = oThis.params.kind || new ClientTransactionTypeModel().kinds[oThis.currentTransactionKind.kind.toString()]
      , currency = (oThis.params.currency
          || new ClientTransactionTypeModel().currencyTypes[oThis.currentTransactionKind.currency_type]).toUpperCase()
      , arbitrary_amount = oThis.params.arbitrary_amount
      , amount = oThis.params.amount || oThis.currentTransactionKind.value_in_usd
          || basicHelper.convertToNormal(oThis.currentTransactionKind.value_in_bt_wei)
      , arbitrary_commission = oThis.params.arbitrary_commission
      , commission_percent = oThis.params.commission_percent || oThis.currentTransactionKind.commission_percent
      , errors_object = []
    ;

    oThis.amount = amount;

    if ( currency == clientTxTypesConst.usdCurrencyType) {

      if( !commonValidator.validateArbitraryAmount(amount, arbitrary_amount) ){
        errors_object.push('invalid_amount_arbitrary_combination');
      } else if ( !commonValidator.validateUsdAmount(amount)){
        errors_object.push('out_of_bound_transaction_usd_value');
      }

      oThis.transactionKindObj['currency_type'] = new ClientTransactionTypeModel().invertedCurrencyTypes[currency];
      oThis.transactionKindObj['value_in_bt_wei'] = null;
      oThis.transactionKindObj['value_in_usd'] = amount;

    } else if ( currency == clientTxTypesConst.btCurrencyType){

      oThis.params.value_in_usd = null;

      if(!commonValidator.validateArbitraryAmount(amount, arbitrary_amount) ){
        errors_object.push('invalid_amount_arbitrary_combination');
      } else if ( !commonValidator.validateBtAmount(amount) ) {
        errors_object.push('out_of_bound_transaction_bt_value');
      }

      if (!commonValidator.isVarNull(amount)) {
        var value_in_bt_wei = basicHelper.convertToWei(amount);
        if(!basicHelper.isWeiValid(value_in_bt_wei)){
          errors_object.push('out_of_bound_transaction_bt_value');
        }
        oThis.transactionKindObj['value_in_bt_wei'] = basicHelper.formatWeiToString(value_in_bt_wei);
      }

      oThis.transactionKindObj['currency_type'] = new ClientTransactionTypeModel().invertedCurrencyTypes[currency];
      oThis.transactionKindObj['value_in_usd'] = null;

    } else {
      errors_object.push('invalid_currency');
    }

    if( !commonValidator.validateArbitraryCommissionPercent(commission_percent, arbitrary_commission) ) {
      errors_object.push('invalid_commission_arbitrary_combination');
    }
    else if( !commonValidator.commissionPercentValid(commission_percent)){
      errors_object.push('invalid_commission_percent');
    }

    if(parseFloat(commission_percent) > 0 && kind != clientTxTypesConst.userToUserKind){
      errors_object.push('invalid_commission_percent');
    }

    if(!oThis.currentTransactionKind || oThis.currentTransactionKind.length==0){
      errors_object.push('invalid_client_transaction_id');
    }

    if(oThis.currentTransactionKind && oThis.currentTransactionKind['client_id'] != client_id){
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'tk_e_1',
        api_error_identifier: 'unauthorized_for_other_client',
        debug_options: {}
      }));
    }

    if (name) {
      name = name.trim();
    }

    if(name && oThis.currentTransactionKind && oThis.currentTransactionKind['name'].toLowerCase() != name.toLowerCase()){

      if(!basicHelper.isTxKindNameValid(name)){
        errors_object.push('invalid_transactionname');
      } else if (basicHelper.hasStopWords(name)) {
        errors_object.push('inappropriate_transactionname');
      }
      else {
        var existingTKind = await new ClientTransactionTypeModel().getTransactionByName({client_id: oThis.currentTransactionKind[client_id], name: name});
        if(existingTKind.length > 0 && oThis.params.id != existingTKind.id){
          errors_object['name'] = "Transaction kind name '"+ name +"' already present.";
        }
      }

    }

    if(errors_object.length > 0){
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
   * Get existing kind record<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  getCurrentTransactionKind: function(){
    var oThis = this;
    return new ClientTransactionTypeModel().getTransactionById({ clientTransactionId: oThis.params.id });
  },

  /**
   * Create new kind in DB.<br><br>
   *
   * @set transactionKindObj
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  editTransactionKind: async function(){
    const oThis = this
    ;

    if(oThis.params.name) oThis.transactionKindObj['name'] = oThis.params.name;

    if(oThis.params.commission_percent) oThis.transactionKindObj['commission_percent'] = oThis.params.commission_percent;

    if(oThis.params.kind) {
      oThis.transactionKindObj['kind'] = oThis.params.kind;
    }

    console.log("transactionKindObj", oThis.transactionKindObj);

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
  returnResponse: async function(){
    const oThis = this
    ;

    console.log("oThis.currentTransactionKind", oThis.currentTransactionKind);

    var actionEntityFormatter = new ActionEntityFormatterKlass({
      id: oThis.params.id,
      client_id: oThis.currentTransactionKind.client_id,
      name: oThis.params.name || oThis.currentTransactionKind.name,
      kind: oThis.transactionKindObj['kind'] || new ClientTransactionTypeModel().kinds[oThis.currentTransactionKind.kind],
      currency: new ClientTransactionTypeModel().currencyTypes[oThis.transactionKindObj['currency_type']]
        || new ClientTransactionTypeModel().currencyTypes[oThis.currentTransactionKind.currency_type],
      arbitrary_amount: oThis.params.arbitrary_amount,
      amount: oThis.amount,
      arbitrary_commission: oThis.params.arbitrary_commission,
      commission_percent: oThis.params.commission_percent || oThis.currentTransactionKind.commission_percent,
      uts: Date.now()
    });

    var actionEntityFormatterRsp = await actionEntityFormatter.perform();

    return Promise.resolve(responseHelper.successWithData(
      {
        result_type: "action",
        action: actionEntityFormatterRsp.data
      }
    ));
  }

};

module.exports = Edit;
