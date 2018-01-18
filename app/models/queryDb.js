"use strict";

var rootPrefix = '../..'
  , mysqlWrapper = require(rootPrefix + "/lib/mysql_wrapper")
  ;

const QueryDB = module.exports = function(dbName){

  this.dbName = dbName

};

QueryDB.prototype.constructor = QueryDB;

// get read connection
QueryDB.prototype.onReadConnection = function() {
  return mysqlWrapper.getPoolFor(this.dbName, 'master');
};

// get read connection
QueryDB.prototype.onWriteConnection = function() {
  return mysqlWrapper.getPoolFor(this.dbName, 'master');
};

/*
 * Public methods
 */
QueryDB.prototype.read = function(q, queryArgs) {
  var oThis = this;
  return new Promise(
    function (onResolve, onReject) {
      // get a timestamp before running the query
      var pre_query = Date.now();
      var qry = oThis.onReadConnection().query(q, queryArgs, function (err, result, fields) {
        console.log("(%s ms) %s", (Date.now() - pre_query), qry.sql);
        if (err) {
          onReject(err);
        } else {
          onResolve(result);
        }
      });

    }
  );
};

QueryDB.prototype.insert = function(tableName, fields, queryArgs) {
  var oThis = this
    , q = 'INSERT INTO '+tableName+' ('+fields+') VALUES (?)'
    ;

  return new Promise(
    function (onResolve, onReject) {
      // get a timestamp before running the query
      var pre_query = Date.now();
      var qry = oThis.onWriteConnection().query(q, queryArgs, function (err, result, fields) {
        console.log("(%s ms) %s", (Date.now() - pre_query), qry.sql);
        if (err) {
          onReject(err);
        } else {
          onResolve(result);
        }
      });

    }
  );
};