"use strict";

var rootPrefix = '../../..'
  , clientTransactionType = require(rootPrefix + '/app/models/client_transaction_type')
  , responseHelper = require(rootPrefix + '/lib/formatter/response.js')
;

const AddNew = function(params){

  this.params = params

};

AddNew.prototype = {

  constructor: AddNew,

  perform: async function () {
    var oThis = this
      , r = null;

    r = await oThis.validateParams();
    if(r.isFailure()){
      return r;
    }

    var result = await oThis.createTransactionKind();

    return Promise.resolve(result);
  },

  validateParams: async function(){
    var oThis = this
      , clientId = oThis.params.client_id
      , name = oThis.params.name
      , kind = oThis.params.kind
      , value_currency_type = oThis.params.value_currency_type
      , value_in_usd = oThis.params.value_in_usd
      , value_in_bt = oThis.params.value_in_bt
      , commission_percent = oThis.params.commission_percent
      , use_price_oracle = parseInt(oThis.params.use_price_oracle)
      , errors_object = {}
    ;

    if(!clientId || clientId==0){
      return Promise.resolve(responseHelper.error('tk_an_3', 'invalid Client'));
    }

    //TODO: check if any charactors to be blocked
    if(!name){
      errors_object['name'] = 'invalid name';
    }
    if(!kind || !clientTransactionType.invertedKinds[kind]){
      errors_object['kind'] = 'invalid kind';
    }

    if (value_currency_type == 'usd' && (!value_in_usd || value_in_usd<=0 ) ) {
      errors_object['value_in_usd'] = 'Value in USD is required';
    } else if (value_currency_type == 'bt' && (!value_in_bt || value_in_bt<=0 ) ){
      errors_object['value_in_bt'] = 'Value in BT is required';
    } else if (!clientTransactionType.invertedValueCurrencyTypes[value_currency_type]){
      errors_object['value_currency_type'] = 'Atleast one currency type to mention';
    }

    if(!commission_percent || commission_percent < 0){
      errors_object['commission_percent'] = 'invalid commission_percent';
    }

    if(use_price_oracle != 1 && use_price_oracle != 0){
      errors_object['use_price_oracle'] = 'Invalid value for use_price_oracle: ' + use_price_oracle;
    }

    var existingTKind = await clientTransactionType.getTransactionByName({clientId: clientId, name: name});
    if(existingTKind.length > 0){
      errors_object['name'] = 'Transaction kind name "'+ name +'" already present.';
    }

    if(Object.keys(errors_object).length > 0){
      console.log("errors_object------------------", errors_object);
      return Promise.resolve(responseHelper.error('tk_e_1', 'invalid params', '', errors_object));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  createTransactionKind: async function(){
    var oThis = this;

    const clientTransactionKind = await clientTransactionType.create({qParams: oThis.params});

    return Promise.resolve(responseHelper.successWithData({client_transaction_kind_id: clientTransactionKind.insertId}));
  }

};

module.exports = AddNew;
