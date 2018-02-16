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
  , ClientTransactionTypeKlass = require(rootPrefix + '/app/models/client_transaction_type')
  , clientTransactionTypeObj = new ClientTransactionTypeKlass()
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

  this.params = params;
  this.transactionKindObj = {};

};

Edit.prototype = {

  constructor: Edit,

  /**
   * perform<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  perform: async function () {

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
      , currency_type = oThis.params.currency_type
      , currency_value = oThis.params.currency_value
      , commission_percent = oThis.params.commission_percent
      , errors_object = {}
    ;

    oThis.clientTransactionId = oThis.params.client_transaction_id;

    if(!oThis.clientTransactionId){
      return Promise.resolve(responseHelper.error('tk_e_4', 'client_transaction_id not present.'));
    }

    if(kind && !clientTransactionTypeObj.invertedKinds[kind]){
      errors_object['kind'] = 'invalid kind';
    }

    if (currency_type == 'usd') {
      if(!currency_value || currency_value<=0 ){
        errors_object['currency_value'] = 'Value in USD is required';
      }
      oThis.transactionKindObj['currency_type'] = oThis.params.currency_type;
      oThis.transactionKindObj['value_in_bt_wei'] = null;
      oThis.transactionKindObj['value_in_usd'] = currency_value;

    } else if (currency_type == 'bt'){
      oThis.params.value_in_usd = null;
      if(!currency_value || currency_value<=0){
        errors_object['currency_value'] = 'Value in BT is required';
      }
      var value_in_bt_wei = basicHelper.convertToWei(currency_value);
      if(!basicHelper.isWeiValid(value_in_bt_wei)){
        errors_object['currency_value'] = 'Value in BT is not valid';
      }
      oThis.transactionKindObj['currency_type'] = oThis.params.currency_type;
      oThis.transactionKindObj['value_in_bt_wei'] = basicHelper.formatWeiToString(value_in_bt_wei);
      oThis.transactionKindObj['value_in_usd'] = null;

    }

    if(commission_percent && parseInt(commission_percent) < 0){
      errors_object['commission_percent'] = 'invalid commission_percent';
    }

    var qResult = await oThis.getCurrentTransactionKind();
    oThis.currentTransactionKind = qResult[0];

    if(!oThis.currentTransactionKind || oThis.currentTransactionKind.length==0){
      errors_object['kind'] = 'invalid kind';
    }

    if(oThis.currentTransactionKind && oThis.currentTransactionKind['client_id'] != clientId){
      return Promise.resolve(responseHelper.error('tk_e_1', 'Unauthorised access.'));
    }

    if(name && oThis.currentTransactionKind && oThis.currentTransactionKind['name'].toLowerCase() != name.toLowerCase()){
      var existingTKind = await clientTransactionTypeObj.getTransactionByName({clientId: clientId, name: name});
      if(existingTKind.length > 0 && oThis.clientTransactionId != existingTKind.id){
        errors_object['name'] = "Transaction kind name '"+ name +"' already present.";
      }
    }

    if(Object.keys(errors_object).length > 0){
      return Promise.resolve(responseHelper.error('tk_e_2', 'invalid params', '', [errors_object]));
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
    return clientTransactionTypeObj.getTransactionById({clientTransactionId: oThis.clientTransactionId});
  },

  /**
   * Create new kind in DB.<br><br>
   *
   * @set transactionKindObj
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  editTransactionKind: async function(){
    var oThis = this;

    if(oThis.params.client_id) oThis.transactionKindObj['client_id'] = oThis.params.client_id;
    if(oThis.params.name) oThis.transactionKindObj['name'] = oThis.params.name;
    if(oThis.params.kind) oThis.transactionKindObj['kind'] = oThis.params.kind;
    if(oThis.params.commission_percent) oThis.transactionKindObj['commission_percent'] = oThis.params.commission_percent;

    try {
      await clientTransactionTypeObj.edit(
        {
          qParams: util.clone(oThis.transactionKindObj),
          whereCondition: {id: oThis.clientTransactionId}
        }
      );
    } catch(err){
      return Promise.resolve(responseHelper.error('tk_e_3', 'Something went wrong.'));
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Return response.<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  returnResponse: function(){
    var oThis = this;
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
          uts: Date.now()
        }]
      }
    ));
  }

};

module.exports = Edit;
