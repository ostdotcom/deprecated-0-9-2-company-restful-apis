"use strict";

var rootPrefix = '../..'
  , mysqlWrapper = require(rootPrefix + "/lib/mysql_wrapper")
  , coreConstants = require(rootPrefix + '/config/core_constants')
  ;

/*
 * Table configuration methods
 */
const dbName = "company_client_"+coreConstants.ENVIRONMENT
  , status = {'1':'incomplete', '2':'complete', '3':'scheduled', '4':'in_preprocessor', '5':'sending', '6':'sent', '7': 'interrupted'}
  ;


/*
 * Private methods
 */
const _private = {

  // get read connection
  onReadConnection: function() {
    return mysqlWrapper.getPoolFor(dbName, 'master');
  },

  // get read connection
  onWriteConnection: function() {
    return mysqlWrapper.getPoolFor(dbName, 'master');
  },

  // fire select query
  query: function(q, queryArgs) {
    return new Promise(
      function (onResolve, onReject) {

        // get a timestamp before running the query
        var pre_query = Date.now();
        var qry = _private.onReadConnection().query(q, queryArgs, function (err, result, fields) {
          //logger.debug("(%s ms) %s", (Date.now() - pre_query), qry.sql);
          if (err) {
            onReject(err);
          } else {
            onResolve(result);
          }
        });

      }
    )
  }
};


/*
 * Public methods
 */
const clientDetail = {

  get: function (clientId) {
    return _private.query("SELECT * FROM clients WHERE id=?", [clientId]);
  }

};

module.exports = clientDetail;