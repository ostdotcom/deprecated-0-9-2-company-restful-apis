"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util.js')
  ;

const dbName = "company_client_economy_"+coreConstants.SUB_ENV+"_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  , kinds = {'1':'user_to_user', '2':'user_to_company', '3':'company_to_user'}
  , invertedKinds = util.invert(kinds)
  , valueCurrencyTypes = {'1':'usd', '2':'bt'}
  , invertedValueCurrencyTypes = util.invert(valueCurrencyTypes)
  , enums = ['kind', 'value_currency_type']
;

/*
 * Public methods
 */
const clientTransactionKind = {

  kinds: kinds,

  invertedKinds: invertedKinds,

  valueCurrencyTypes: valueCurrencyTypes,

  invertedValueCurrencyTypes: invertedValueCurrencyTypes,

  convertEnumForDB: function (params, readable) {
    var oThis = this;

    for(var i=0; i<enums.length; i++){
      var enum_k = enums[i];
      console.log("------", enum_k, params[enum_k]);
      if(params[enum_k]){
        if (enum_k == 'kind') {
          params[enum_k] = readable ? oThis.kinds[params[enum_k]] : oThis.invertedKinds[params[enum_k]];
        } else if (enum_k == 'value_currency_type') {
          params[enum_k] = readable ? oThis.valueCurrencyTypes[params[enum_k]] : oThis.invertedValueCurrencyTypes[params[enum_k]];
        }
      }
    }
    return params;
  },

  convertEnumForResult: function (params) {
    return this.convertEnumForDB(params, true);
  },

  getAll: async function (params) {

    var oThis = this
      , return_result = []
    ;

    var results = await QueryDB.read(
      'client_transactions',
      ['client_id','name', 'kind', 'value_currency_type', 'value_in_usd', 'value_in_bt', 'commission_percent'],
      'client_id=?',
      [params['clientId']]
    );

    for(var i=0; i<results.length; i++){
      return_result.push(oThis.convertEnumForResult(results[i]));
    }

    return Promise.resolve(return_result);

  },

  getTransactionById: function (params) {
    return QueryDB.read('client_transactions', [], 'id=?', [params['clientTransactionId']]);
  },

  getTransactionByName: function (params) {
    return QueryDB.read('client_transactions', [], 'client_id=? AND name=?', [params['clientId'], params['name']]);
  },

  create: function (params) {

    var oThis = this
      , creatableFields = ['client_id', 'name', 'kind', 'value_currency_type', 'value_in_usd', 'value_in_bt', 'commission_percent']
      , createFields = []
      , setFieldsValues = []
    ;

    params['qParams'] = oThis.convertEnumForDB(params['qParams']);
    params['qParams']['value_in_usd'] = params['qParams']['value_in_usd'] || -1;
    params['qParams']['value_in_bt'] = params['qParams']['value_in_bt'] || -1;
    params['qParams']['commission_percent'] = params['qParams']['commission_percent'] || 0;

    for(var i=0; i<creatableFields.length; i++){
      if(params['qParams'][creatableFields[i]]){
        console.log("------$$$$$----", creatableFields[i], "=>",params['qParams'][creatableFields[i]]);
        createFields.push(creatableFields[i]);
        setFieldsValues.push(params['qParams'][creatableFields[i]])
      }
    }

    return QueryDB.insert(
      'client_transactions',
      createFields,
      setFieldsValues
    );

  },

  edit: function (params) {

    var oThis = this
      , editableFields = ['name', 'kind', 'value_currency_type', 'value_in_usd', 'value_in_bt', 'commission_percent']
      , editFields = []
      , setFieldsValues = []
      , whereCondFields = []
      , whereCondFieldsValues = []
    ;

    params['qParams'] = oThis.convertEnumForDB(params['qParams']);
    console.log("===============", params['qParams']);
    for(var i=0; i<editableFields.length; i++){
      if(params['qParams'][editableFields[i]]){
        editFields.push(editableFields[i]+'=?');
        setFieldsValues.push(params['qParams'][editableFields[i]])
      }
    }

    for(var key in params['whereCondition']){
      whereCondFields.push(key+'=?');
      whereCondFieldsValues.push(params['whereCondition'][key]);
    }

    return QueryDB.edit(
      'client_transactions',
      editFields,
      setFieldsValues,
      whereCondFields,
      whereCondFieldsValues
    );

  }

};

module.exports = clientTransactionKind;