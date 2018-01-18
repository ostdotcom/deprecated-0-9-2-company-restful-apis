"use strict";

var rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  ;

/*
 * Table configuration methods
 */
const dbName = "company_client_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  ;

/*
 * Public methods
 */
const clientDetail = {

  get: function (clientId) {
    return QueryDB.read("SELECT * FROM clients WHERE id=?", [clientId]);
  }

};

module.exports = clientDetail;