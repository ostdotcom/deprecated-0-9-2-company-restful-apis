"use strict";

const rootPrefix = '../..'
  , MysqlQueryKlass = require(rootPrefix + '/lib/query_builders/mysql')
  , mysqlWrapper = require(rootPrefix + "/lib/mysql_wrapper")
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

const ModelBaseKlass = function (params) {
  const oThis = this
  ;

  oThis.dbName = params.dbName;
  MysqlQueryKlass.call(this);
};

ModelBaseKlass.prototype = Object.create(MysqlQueryKlass.prototype);

const ModelBaseKlassPrototype = {

  // get read connection
  onReadConnection: function () {
    return mysqlWrapper.getPoolFor(this.dbName, 'master');
  },

  // on write connection
  onWriteConnection: function () {
    return mysqlWrapper.getPoolFor(this.dbName, 'master');
  },

  convertEnumForDB: function (params, readable) {
    const oThis = this
      , enumKeys = Object.keys(oThis.enums);

    for (var i = 0; i < enumKeys.length; i++) {
      var enum_k = enumKeys[i];

      if (params[enum_k]) {
        params[enum_k] = readable ? oThis.enums[enum_k]['val'][params[enum_k]] : oThis.enums[enum_k]['inverted'][params[enum_k]];
      }
    }
    return params;
  },

  convertEnumForResult: function (params) {
    return this.convertEnumForDB(params, true);
  },

  fire: function () {
    const oThis = this;

    return new Promise(
      function (onResolve, onReject) {

        const queryGenerator = oThis.generate();
        if (queryGenerator.isSuccess()) {
          //logger.log(queryGenerator.data.query, queryGenerator.data.queryData);
        }

        var pre_query = Date.now();
        var qry = oThis.onWriteConnection().query(queryGenerator.data.query, queryGenerator.data.queryData, function (err, result, fields) {
          logger.info("(" + (Date.now() - pre_query) + " ms)", qry.sql);
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

Object.assign(ModelBaseKlass.prototype, ModelBaseKlassPrototype);

module.exports = ModelBaseKlass;