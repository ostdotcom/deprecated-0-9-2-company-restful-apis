"use strict";

var rootPrefix = '../..'
  , mysqlWrapper = require(rootPrefix + "/lib/mysql_wrapper")
  ;

const QueryDB = function(dbName){

  this.dbName = dbName

};

QueryDB.prototype = {

  constructor: QueryDB,

  // get read connection
  onReadConnection: function() {
    return mysqlWrapper.getPoolFor(this.dbName, 'master');
  },

  // get read connection
  onWriteConnection: function() {
    return mysqlWrapper.getPoolFor(this.dbName, 'master');
  },

  read: function(tableName, fields, whereClause, whereClauseValues) {
    var oThis = this
      , selectFields = ((!fields || fields.length==0) ? '*' : fields.join(','))
      , selectWhereClause = ((!whereClause || whereClause.length==0) ? '' : 'where '+whereClause)
      , q = 'SELECT '+selectFields+' FROM '+tableName+' '+selectWhereClause;

    return new Promise(
      function (onResolve, onReject) {
        // get a timestamp before running the query
        var pre_query = Date.now();
        var qry = oThis.onReadConnection().query(q, whereClauseValues, function (err, result, fields) {
          console.log("(%s ms) %s", (Date.now() - pre_query), qry.sql);
          if (err) {
            onReject(err);
          } else {
            onResolve(result);
          }
        });

      }
    );
  },

  insert: function(tableName, fields, queryArgs) {
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
  }

};

module.exports = QueryDB;