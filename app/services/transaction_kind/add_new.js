"use strict";

var rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , util = require(rootPrefix + '/lib/util')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ClientTransactionTypeKlass = require(rootPrefix + '/app/models/client_transaction_type')
  , clientTransactionTypeObj = new ClientTransactionTypeKlass()
;

const AddNew = function(params){

  var oThis = this;

  oThis.params = params;

  oThis.transactionKindObj = {};

};

AddNew.prototype = {

  constructor: AddNew,

  perform: async function () {
    var oThis = this
      , r = null;

    r = await oThis.validateParams();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.createTransactionKind();
    if(r.isFailure()) return Promise.resolve(r);

    return oThis.returnResponse();
  },

  validateParams: async function(){
    var oThis = this
      , client_id = oThis.params.client_id
      , name = oThis.params.name
      , kind = oThis.params.kind
      , currency_type = oThis.params.currency_type
      , currency_value = oThis.params.currency_value
      , commission_percent = oThis.params.commission_percent
      , errors_object = {}
    ;

    if(!client_id || client_id==0){
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
      if(!currency_value || currency_value<=0){
        errors_object['currency_value'] = 'currency value in USD is required';
      }
      oThis.transactionKindObj.value_in_usd = currency_value;
    } else if (currency_type == 'bt' ){
      if(!currency_value || currency_value<=0 ){
        errors_object['currency_value'] = 'currency value in BT is required';
      }
      var value_in_bt_wei = basicHelper.convertToWei(currency_value);
      if(!basicHelper.isWeiValid(value_in_bt_wei)){
        errors_object['currency_value'] = 'currency value in BT is not valid';
      }
      oThis.transactionKindObj.value_in_bt_wei = basicHelper.formatWeiToString(value_in_bt_wei);
    } else {
      errors_object['currency_type'] = 'Atleast one currency type(usd or bt) to mention';
    }

    if(!commission_percent || commission_percent < 0){
      errors_object['commission_percent'] = 'invalid commission_percent';
    }

    var existingTKind = await clientTransactionTypeObj.getTransactionByName({clientId: client_id, name: name});
    if(existingTKind.length > 0){
      errors_object['name'] = 'Transaction kind name "'+ name +'" already present.';
    }

    if(Object.keys(errors_object).length > 0){
      console.log("errors_object------------------", errors_object);
      return Promise.resolve(responseHelper.error('tk_an_2', 'invalid params', '', [errors_object]));
    }

    oThis.transactionKindObj.client_id = client_id;
    oThis.transactionKindObj.name = name;
    oThis.transactionKindObj.kind = kind;
    oThis.transactionKindObj.currency_type = currency_type;
    oThis.transactionKindObj.commission_percent = commission_percent;
    oThis.transactionKindObj.status = 'active';

    return Promise.resolve(responseHelper.successWithData({}));

  },

  createTransactionKind: async function(){
    var oThis = this;

    try{
      const clientTransactionKind = await clientTransactionTypeObj.create(util.clone(oThis.transactionKindObj));
      oThis.transactionKindObj.id = clientTransactionKind.insertId;
    } catch(err){
      return Promise.resolve(responseHelper.error('tk_an_3', 'Something went wrong.'));
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  returnResponse: function(){
    var oThis = this;
    return Promise.resolve(responseHelper.successWithData(
      {
        result_type: "transactions",
        transactions: [{
          id: oThis.transactionKindObj.id,
          client_id: oThis.transactionKindObj.client_id,
          name: oThis.transactionKindObj.name,
          kind: oThis.transactionKindObj.kind,
          currency_type: oThis.params.currency_type,
          currency_value: oThis.params.currency_value,
          commission_percent: oThis.transactionKindObj.commission_percent,
          status: oThis.transactionKindObj.status,
          uts: Date.now()
        }]
      }
    ));
  }

};

module.exports = AddNew;
