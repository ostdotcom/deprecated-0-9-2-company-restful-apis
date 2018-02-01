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

    return Promise.resolve(responseHelper.successWithData(result));
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
    ;

    if(!clientId || clientId==0 || !name || !kind){
      return Promise.resolve(responseHelper.error('tk_an_1', 'invalid kind'));
    }

    //TODO: check if any charactors to be blocked
    if(!name){
      return Promise.resolve(responseHelper.error('tk_an_1', 'invalid name'));
    }
    if(!clientTransactionType.invertedKinds[kind]){
      return Promise.resolve(responseHelper.error('tk_an_2', 'invalid kind'));
    }

    if (value_currency_type == 'usd' && (!value_in_usd || value_in_usd<=0 ) ) {
      return Promise.resolve(responseHelper.error('tk_an_3', 'Value in USD is required'));
    } else if (value_currency_type == 'bt' && (!value_in_bt || value_in_bt<=0 ) ){
      return Promise.resolve(responseHelper.error('tk_an_4', 'Value in BT is required'));
    } else if (!clientTransactionType.invertedValueCurrencyTypes[value_currency_type]){
      return Promise.resolve(responseHelper.error('tk_an_5', 'Atleast one currency type to mention'));
    }

    if(!commission_percent || commission_percent < 0){
      return Promise.resolve(responseHelper.error('tk_an_6', 'invalid commission_percent'));
    }

    var existingTKind = await clientTransactionType.getTransactionByName({clientId: clientId, name: name});
    if(existingTKind.length > 0){
      return Promise.resolve(responseHelper.error('tk_an_7', "Transaction kind name '"+ name +"' already present."));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  createTransactionKind: function(){
    var oThis = this;

    return clientTransactionType.create({qParams: oThis.params});
  }

};

module.exports = AddNew;
