"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  ;

const dbName = "saas_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
  , kinds = {'1':'user_to_user', '2':'user_to_company', '3':'company_to_user'}
  , invertedKinds = util.invert(kinds)
  , valueCurrencyTypes = {'1':'usd', '2':'bt'}
  , invertedValueCurrencyTypes = util.invert(valueCurrencyTypes)
;

const ClientTransactionTypeKlass = function () {};

ClientTransactionTypeKlass.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const ClientTransactionTypeKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'client_transaction_types',

  kinds: kinds,

  invertedKinds: invertedKinds,

  valueCurrencyTypes: valueCurrencyTypes,

  invertedValueCurrencyTypes: invertedValueCurrencyTypes,

  enums: {
    'kind': {
      val: kinds,
      inverted: invertedKinds
    },
    'value_currency_type': {
      val: valueCurrencyTypes,
      inverted: invertedValueCurrencyTypes
    }
  },

  getAll: async function (params) {

    var oThis = this
      , return_result = []
    ;

    var results = await oThis.QueryDB.read(
      tableName,
      ['id', 'client_id','name', 'kind', 'value_currency_type', 'value_in_usd',
        'value_in_bt', 'commission_percent', 'use_price_oracle'],
      'client_id=?',
      [params['clientId']]
    );

    for(var i=0; i<results.length; i++){
      return_result.push(oThis.convertEnumForResult(results[i]));
    }

    return Promise.resolve(return_result);

  },

  getTransactionById: function (params) {
    var oThis = this;
    return oThis.QueryDB.read(oThis.tableName, [], 'id=?', [params['clientTransactionId']]);
  },

  getTransactionByName: function (params) {
    var oThis = this;
    return oThis.QueryDB.read(oThis.tableName, [], 'client_id=? AND name=?', [params['clientId'], params['name']]);
  }

};

Object.assign(ClientTransactionTypeKlass.prototype, ClientTransactionTypeKlassPrototype);

module.exports = ClientTransactionTypeKlass;