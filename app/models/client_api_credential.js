"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
;

const dbName = "company_saas_shared_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  , tableName = 'client_api_credentials'
;

/*
 * Public methods
 */
const clientApiCredential = {

  getClientApi: function(apiKey){
    return QueryDB.read(
      tableName,
      ['client_id','api_key', 'api_secret', 'api_salt'],
      'api_key=?',
      [apiKey]);
  }

};

module.exports = clientApiCredential;