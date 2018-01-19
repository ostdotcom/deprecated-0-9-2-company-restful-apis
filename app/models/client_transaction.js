"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  ;

const dbName = "company_client_economy_"+coreConstants.SUB_ENV+"_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  ;

/*
 * Public methods
 */
const clientTransaction = {

  kinds: {'1':'user_to_user', '2':'user_to_company', '3':'company_to_user'},

  valueCurrencyTypes: {'1':'usd', '2':'bt'},

  getAll: function (params) {
    return QueryDB.read('client_transactions', [], 'client_id=?', [params['clientId']]);
  },

  getTransaction: function (params) {
    return QueryDB.read('client_transactions', [], 'client_id=? AND name=?', [params['clientId'], params['tName']]);
  },

  create: function (params) {

    return QueryDB.insert(
      'client_transactions',
      params['fields'],
      params['values']
    );

  }

};

module.exports = clientTransaction;