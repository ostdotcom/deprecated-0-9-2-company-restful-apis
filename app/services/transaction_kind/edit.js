"use strict";

var rootPrefix = '../../..'
  , clientTransactionType = require(rootPrefix + '/app/models/client_transaction_type')
  , responseHelper = require(rootPrefix + '/lib/formatter/response.js')
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

    await oThis.editTransactionKind();

    return Promise.resolve(responseHelper.successWithData({}));

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
    ;

    oThis.clientTransactionId = oThis.params.client_transaction_id;

    if(!clientId || clientId==0 || !oThis.clientTransactionId){
      return Promise.resolve(responseHelper.error('tk_e_1', 'invalid params'));
    }

    if(kind && !clientTransactionType.invertedKinds[kind]){
      return Promise.resolve(responseHelper.error('tk_e_2', 'invalid kind'));
    }

    if (value_currency_type == 'usd' && (!value_in_usd || value_in_usd<=0 ) ) {
      return Promise.resolve(responseHelper.error('tk_e_3', 'Value in USD is required'));
    } else if (value_currency_type == 'bt' && (!value_in_bt || value_in_bt<=0 ) ){
      return Promise.resolve(responseHelper.error('tk_e_4', 'Value in BT is required'));
    }

    var qResult = await oThis.getCurrentTransactionKind();
    oThis.currentTransactionKind = qResult[0];

    if(!oThis.currentTransactionKind || oThis.currentTransactionKind.length==0){
      return Promise.resolve(responseHelper.error('tk_e_5', 'Transaction Kind is not found for the client'));
    }

    if(oThis.currentTransactionKind['client_id'] != clientId){
      return Promise.resolve(responseHelper.error('tk_e_6', 'Unauthorised access.'));
    }

    if(use_price_oracle != 1 && use_price_oracle != 0){
      return Promise.resolve(responseHelper.error('tk_e_7', 'Invalid value for use_price_oracle: ' + use_price_oracle));
    }

    if(name && oThis.currentTransactionKind['name'].toLowerCase() != name.toLowerCase()){
      var existingTKind = await clientTransactionType.getTransactionByName({clientId: clientId, name: name});
      if(existingTKind.length > 0){
        return Promise.resolve(responseHelper.error('tk_e_8', "Transaction kind name '"+ name +"' already present."));
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  getCurrentTransactionKind: function(){
    var oThis = this;
    return clientTransactionType.getTransactionById({clientTransactionId: oThis.clientTransactionId});
  },

  editTransactionKind: function(){
    var oThis = this;

    return clientTransactionType.edit(
      {
        qParams: oThis.params,
        whereCondition: {id: oThis.clientTransactionId}
      }
    );

  }

};

module.exports = Edit;
