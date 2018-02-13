"use strict";

var rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  ;

<<<<<<< HEAD:app/models/client.js
/*
 * Table configuration methods
 */
const dbName = "company_client_"+coreConstants.ENVIRONMENT
=======
const dbName = "company_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
>>>>>>> Code review changes:app/models/client_token.js
  , QueryDB = new QueryDBKlass(dbName)
  , tableName = 'clients'
  ;

/*
 * Public methods
 */
const clientDetail = {

  get: function (clientId) {
    return QueryDB.read(
      tableName,
      [],
      'id=?',
      [clientId]);
  }

};

module.exports = clientDetail;