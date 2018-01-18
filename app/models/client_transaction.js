"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  ;

const dbName = "company_client_economy_"+coreConstants.SUB_ENV+"_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  , kind = {'1':'user_to_user', '2':'user_to_company', '3':'company_to_user'}
  , value_currency_type = {'1':'usd', '2':'bt'}
  ;

/*
 * Public methods
 */
const clientTransaction = {

  getAll: function (params) {
    return QueryDB.read("SELECT * FROM client_transactions WHERE client_id=?", [params['clientId']]);
  },

  getTransaction: function (clientId, tName) {
    return QueryDB.read("SELECT * FROM client_transactions WHERE client_id=? AND name=?", [clientId, tName]);
  },

  createTransaction: function (clientId, tName) {

  }

};

module.exports = clientTransaction;