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
const clientApiCredential = {

  getClientApi: function(apiKey){
    return QueryDB.read('client_api_credentials',
      ['client_id','api_key', 'api_secret'],
      'api_key=?',
      [apiKey]);
  }

};

module.exports = clientApiCredential;