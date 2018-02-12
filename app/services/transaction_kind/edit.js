"use strict";

var rootPrefix = '../../..'
  , clientTransactionType = require(rootPrefix + '/app/models/client_transaction_type')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

const Edit = function(params){

  this.params = params

};

Edit.prototype = {

  constructor: Edit,

  perform: async function () {

    var oThis = this
      , r = null;

    r = await oThis.validateParams();
    if(r.isFailure()){
      return r;
    }

    return Promise.resolve(await oThis.editTransactionKind());

  },

  validateParams: async function(){
    var oThis = this
      , clientId = oThis.params.client_id
      , name = oThis.params.name
      , kind = oThis.params.kind
      , value_currency_type = oThis.params.value_currency_type
      , value_in_usd = oThis.params.value_in_usd
      , value_in_bt = oThis.params.value_in_bt
      , use_price_oracle = parseInt(oThis.params.use_price_oracle)
      , errors_object = {}
    ;

    oThis.clientTransactionId = oThis.params.client_transaction_id;

    if(!oThis.clientTransactionId){
      return Promise.resolve(responseHelper.error('tk_e_4', 'client_transaction_id not present.'));
    }

    if(kind && !clientTransactionType.invertedKinds[kind]){
      errors_object['kind'] = 'invalid kind';
    }

    if (value_currency_type == 'usd' && (!value_in_usd || value_in_usd<=0 ) ) {
      errors_object['value_in_usd'] = 'Value in USD is required';
    } else if (value_currency_type == 'bt' && (!value_in_bt || value_in_bt<=0 ) ){
      errors_object['value_in_bt'] = 'Value in BT is required';
    }

    var qResult = await oThis.getCurrentTransactionKind();
    oThis.currentTransactionKind = qResult[0];

    if(!oThis.currentTransactionKind || oThis.currentTransactionKind.length==0){
      errors_object['kind'] = 'invalid kind';
    }

    if(oThis.currentTransactionKind && oThis.currentTransactionKind['client_id'] != clientId){
      return Promise.resolve(responseHelper.error('tk_e_1', 'Unauthorised access.'));
    }

    if(use_price_oracle != 1 && use_price_oracle != 0){
      errors_object['use_price_oracle'] = 'Invalid value for use_price_oracle: ' + use_price_oracle;
    }

    if(name && oThis.currentTransactionKind && oThis.currentTransactionKind['name'].toLowerCase() != name.toLowerCase()){
      var existingTKind = await clientTransactionType.getTransactionByName({clientId: clientId, name: name});
      if(existingTKind.length > 0 && oThis.clientTransactionId != existingTKind.id){
        errors_object['name'] = "Transaction kind name '"+ name +"' already present.";
      }
    }

    if(Object.keys(errors_object).length > 0){
      return Promise.resolve(responseHelper.error('tk_e_2', 'invalid params', '', errors_object));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  getCurrentTransactionKind: function(){
    var oThis = this;
    return clientTransactionType.getTransactionById({clientTransactionId: oThis.clientTransactionId});
  },

  editTransactionKind: async function(){
    var oThis = this;

    var editedTransactionType = await clientTransactionType.edit(
      {
        qParams: oThis.params,
        whereCondition: {id: oThis.clientTransactionId}
      }
    );

    return Promise.resolve(responseHelper.successWithData({client_transaction_kind_id: oThis.clientTransactionId}));
  }

};

module.exports = Edit;
