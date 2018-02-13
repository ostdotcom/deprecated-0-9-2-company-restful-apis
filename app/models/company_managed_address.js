"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , localCipher = require(rootPrefix + '/lib/authentication/local_cipher')
;

const dbName = "company_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  , tableName = 'company_managed_addresses'
;

/*
 * Public methods
 */
const address = {

  getByEthAddress: function(ethAddress){
    var hashedAddr = localCipher.getShaHashedText(ethAddress);
    return QueryDB.read(
      tableName,
      [],
      'hashed_ethereum_address=?',
      [hashedAddr]);
  },

  getByIds: function(ids){
    return QueryDB.readByIds(
      tableName,
      ['id', 'ethereum_address'],
      ids);
  },

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

module.exports = address;