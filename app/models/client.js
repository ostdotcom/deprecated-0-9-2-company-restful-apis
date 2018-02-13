"use strict";

var rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  ;

/*
 * Table configuration methods
 */

const dbName = "company_client_economy_"+"_"+coreConstants.ENVIRONMENT

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