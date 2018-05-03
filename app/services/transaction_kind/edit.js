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
  , ClientTransactionTypeCacheKlass = require(rootPrefix + '/lib/cache_management/client_transaction_type')
  , clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/**
 * Edit transaction kind constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom setup is to be made.
 * @param {string} [params.name] - Name of the transaction kind eg. voteUp, voteDown, etc..
 * @param {string} [params.kind] - The kind of the kind, user_to_user, user_to_client, etc..
 * @param {string} [params.currency_type] - Type of currency. usd or bt
 * @param {decimal} [params.currency_value] - Value of currency with respect to currency_type
 * @param {decimal} [params.commission_percent] - commission in percentage.
 *
 * @constructor
 *
 */
const Edit = function(params){

  this.params = params || {};
  this.transactionKindObj = {};

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
      , clientId = oThis.params.client_id
      , name = oThis.params.name
      , kind = oThis.params.kind
      , currency_type = (oThis.params.currency_type || '').toUpperCase()
      , currency_value = oThis.params.currency_value
      , commission_percent = oThis.params.commission_percent
      , errors_object = []
    ;

    oThis.clientTransactionId = oThis.params.client_transaction_id;

    if(!oThis.clientTransactionId){
      return Promise.resolve(responseHelper.error({
        internal_error_identifier: 'tk_e_4',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_client_transaction_id'],
        debug_options: {}
      }));
    }

    if(kind && !new ClientTransactionTypeModel().invertedKinds[kind]){
      errors_object.push('invalid_transactionkind');
    }

    if (currency_type == 'USD') {
      if(!currency_value || currency_value < 0.01 || currency_value > 100){
        errors_object.push('out_of_bound_transaction_usd_value');
      }
      oThis.transactionKindObj['currency_type'] = new ClientTransactionTypeModel().invertedCurrencyTypes[oThis.params.currency_type];
      oThis.transactionKindObj['value_in_bt_wei'] = null;
      oThis.transactionKindObj['value_in_usd'] = currency_value;

    } else if (currency_type == 'BT'){
      oThis.params.value_in_usd = null;
      if(!currency_value || currency_value < 0.00001 || currency_value>100){
        errors_object.push('out_of_bound_transaction_bt_value');
      }
      var value_in_bt_wei = basicHelper.convertToWei(currency_value);
      if(!basicHelper.isWeiValid(value_in_bt_wei)){
        errors_object.push('out_of_bound_transaction_bt_value');
      }
      oThis.transactionKindObj['currency_type'] = new ClientTransactionTypeModel().invertedCurrencyTypes[oThis.params.currency_type];
      oThis.transactionKindObj['value_in_bt_wei'] = basicHelper.formatWeiToString(value_in_bt_wei);
      oThis.transactionKindObj['value_in_usd'] = null;

    }

    if(commission_percent && (parseInt(commission_percent) < 0 || parseFloat(commission_percent) > 100)){
      errors_object.push('invalid_commission_percent');
    }

    if(parseFloat(commission_percent) > 0 && kind != clientTxTypesConst.userToUserKind){
      errors_object.push('invalid_commission_percent');
    }

    var qResult = await oThis.getCurrentTransactionKind();
    oThis.currentTransactionKind = qResult[0];

    if(!oThis.currentTransactionKind || oThis.currentTransactionKind.length==0){
      errors_object.push('invalid_client_transaction_id');
    }

    if(oThis.currentTransactionKind && oThis.currentTransactionKind['client_id'] != clientId){
      return Promise.resolve(responseHelper.error({
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
        var existingTKind = await new ClientTransactionTypeModel().getTransactionByName({clientId: clientId, name: name});
        if(existingTKind.length > 0 && oThis.clientTransactionId != existingTKind.id){
          errors_object['name'] = "Transaction kind name '"+ name +"' already present.";
        }
      }

    }

    if(Object.keys(errors_object).length > 0){
      return Promise.resolve(responseHelper.error({
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
    return new ClientTransactionTypeModel().getTransactionById({clientTransactionId: oThis.clientTransactionId});
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

    if(oThis.params.client_id) oThis.transactionKindObj['client_id'] = oThis.params.client_id;
    if(oThis.params.name) oThis.transactionKindObj['name'] = oThis.params.name;
    if(oThis.params.kind) oThis.transactionKindObj['kind'] = new ClientTransactionTypeModel().invertedKinds[oThis.params.kind];
    if(oThis.params.commission_percent) oThis.transactionKindObj['commission_percent'] = oThis.params.commission_percent;

    await new ClientTransactionTypeModel().update(
      util.clone(oThis.transactionKindObj)
    ).where({id: oThis.clientTransactionId}).fire();

    new ClientTransactionTypeCacheKlass({client_id: oThis.currentTransactionKind['client_id'],
      transaction_kind: oThis.currentTransactionKind['name']}).clear();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Return response.<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  returnResponse: function(){
    const oThis = this
    ;

    return Promise.resolve(responseHelper.successWithData(
      {
        result_type: "transactions",
        transactions: [{
          id: oThis.clientTransactionId,
          client_id: oThis.params.client_id,
          name: oThis.params.name,
          kind: oThis.params.kind,
          currency_type: oThis.params.currency_type,
          currency_value: oThis.params.currency_value,
          device_id: oThis.params.device_id,
          commission_percent: oThis.params.commission_percent,
          uts: Date.now()
        }]
      }
    ));
  }

};

module.exports = Edit;
