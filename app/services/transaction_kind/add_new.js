"use strict";

var rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , util = require(rootPrefix + '/lib/util')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ClientTransactionTypeKlass = require(rootPrefix + '/app/models/client_transaction_type')
  , clientTransactionTypeObj = new ClientTransactionTypeKlass()
;

const AddNew = function(params){

  this.params = params;
  this.transactionKindObj = {};

};

AddNew.prototype = {

  constructor: AddNew,

  perform: async function () {
    var oThis = this
      , r = null;

    r = await oThis.validateParams();
    if(r.isFailure()) Promise.resolve(r);

    r = await oThis.createTransactionKind();
    if(r.isFailure()) Promise.resolve(r);

    return oThis.returnResponse();
  },

  validateParams: async function(){
    var oThis = this
      , clientId = oThis.params.client_id
      , name = oThis.params.name
      , kind = oThis.params.kind
      , currency_type = oThis.params.currency_type
      , value_in_usd = oThis.params.value_in_usd
      , value_in_bt = oThis.params.value_in_bt
      , commission_percent = oThis.params.commission_percent
      , errors_object = {}
    ;

    if(!clientId || clientId==0){
      return Promise.resolve(responseHelper.error('tk_an_1', 'invalid Client'));
    }

    //TODO: check if any charactors to be blocked
    if(!name){
      errors_object['name'] = 'invalid name';
    }
    if(!kind || !clientTransactionTypeObj.invertedKinds[kind]){
      errors_object['kind'] = 'invalid kind';
    }

    if (currency_type == 'usd' ) {
      if(!value_in_usd || value_in_usd<=0){
        errors_object['value_in_usd'] = 'Value in USD is required';
      }
      oThis.params.value_in_bt = null;
    } else if (currency_type == 'bt' ){
      oThis.params.value_in_usd = null;
      if(!value_in_bt || value_in_bt<=0 ){
        errors_object['value_in_bt'] = 'Value in BT is required';
      }
      var value_in_bt_wei = basicHelper.convertToWei(value_in_bt);
      if(!basicHelper.isWeiValid(value_in_bt_wei)){
        errors_object['value_in_bt'] = 'Value in BT is not valid';
      }
      oThis.params.value_in_bt_wei = basicHelper.formatWeiToString(value_in_bt_wei);
    } else {
      errors_object['currency_type'] = 'Atleast one currency type(usd or bt) to mention';
    }

    if(!commission_percent || commission_percent < 0){
      errors_object['commission_percent'] = 'invalid commission_percent';
    }

    var existingTKind = await clientTransactionTypeObj.getTransactionByName({clientId: clientId, name: name});
    if(existingTKind.length > 0){
      errors_object['name'] = 'Transaction kind name "'+ name +'" already present.';
    }

    if(Object.keys(errors_object).length > 0){
      console.log("errors_object------------------", errors_object);
      return Promise.resolve(responseHelper.error('tk_an_2', 'invalid params', '', [errors_object]));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  createTransactionKind: async function(){
    var oThis = this;

    oThis.transactionKindObj = {
      client_id: oThis.params.client_id,
      name: oThis.params.name,
      kind: oThis.params.kind,
      currency_type: oThis.params.currency_type,
      value_in_usd: oThis.params.value_in_usd,
      value_in_bt_wei: oThis.params.value_in_bt_wei,
      commission_percent: oThis.params.commission_percent,
      status: 'active'
    };

    try{
      const clientTransactionKind = await clientTransactionTypeObj.create(util.clone(oThis.transactionKindObj));
      oThis.transactionKindObj['id'] = clientTransactionKind.insertId;
    } catch(err){
      return Promise.resolve(responseHelper.error('tk_an_3', 'Something went wrong.'));
    }

    oThis.transactionKindObj['uts'] = Date.now();
    oThis.transactionKindObj['value_in_bt'] = oThis.params.value_in_bt;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  returnResponse: function(){
    var oThis = this;
    return Promise.resolve(responseHelper.successWithData(
      {
        result_type: "transactions",
        transactions: [oThis.transactionKindObj]
      }
    ));
  }

};

module.exports = AddNew;
