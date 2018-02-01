"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , localCipher = require(rootPrefix + '/lib/authentication/local_cipher')
;

const dbName = "company_client_economy_"+coreConstants.SUB_ENV+"_"+coreConstants.ENVIRONMENT
  , QueryDB = new QueryDBKlass(dbName)
  , tableName = 'company_managed_addresses'
;

/*
 * Public methods
 */
const address = {

  get: function(ethAddress){
    var hashedAddr = localCipher.getShaHashedText(ethAddress);
    return QueryDB.read(
      tableName,
      [],
      'hashed_ethereum_address=?',
      [hashedAddr]);
  },

  create: function (params) {

    var oThis = this
      , creatableFields = ['ethereum_address', 'hashed_ethereum_address', 'passphrase']
      , createFields = []
      , setFieldsValues = []
    ;

    for(var i=0; i<creatableFields.length; i++){
      if(params[creatableFields[i]]){
        createFields.push(creatableFields[i]);
        setFieldsValues.push(params[creatableFields[i]])
      }
    }

    return QueryDB.insert(
      tableName,
      createFields,
      setFieldsValues
    );

  }

};

module.exports = address;