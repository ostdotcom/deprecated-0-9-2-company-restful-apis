"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
;

const dbName = "company_client_economy_"+coreConstants.SUB_ENV+"_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  , tableName = 'client_tokens'
;

/*
 * Public methods
 */
const clientToken = {

  get: function(clientTokenId){
    return QueryDB.read(
      tableName,
      [],
      'id=?',
      [clientTokenId]);
  }

};

module.exports = clientToken;