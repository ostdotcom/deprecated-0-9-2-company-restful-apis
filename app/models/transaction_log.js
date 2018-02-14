"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
;

const dbName = "company_transaction_"+coreConstants.SUB_ENV+"_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  , tableName = 'transaction_logs'
;

/*
 * Public methods
 */
const transactionLog = {

  create: function (params) {

    var createFields = []
      , setFieldsValues = []
    ;

    for(var key in params){
      createFields.push(key);
      setFieldsValues.push(params[key])
    }

    return QueryDB.insert(
      tableName,
      createFields,
      setFieldsValues
    );

  },

  edit: function (params) {
    var editFields = []
      , setFieldsValues = []
      , whereCondFields = []
      , whereCondFieldsValues = []
    ;

    for(var key in params['qParams']){
      editFields.push(key+'=?');
      setFieldsValues.push(params['qParams'][key])
    }

    for(var key in params['whereCondition']){
      whereCondFields.push(key+'=?');
      whereCondFieldsValues.push(params['whereCondition'][key]);
    }

    return QueryDB.edit(
      tableName,
      editFields,
      setFieldsValues,
      whereCondFields,
      whereCondFieldsValues
    );
  }

};

module.exports = transactionLog;