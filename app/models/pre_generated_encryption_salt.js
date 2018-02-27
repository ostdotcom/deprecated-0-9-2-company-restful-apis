"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
;

const dbName = "saas_big_" + coreConstants.SUB_ENVIRONMENT + "_" + coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
;

const PreGeneratedEncryptionSaltKlass = function () {
};

PreGeneratedEncryptionSaltKlass.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const PreGeneratedEncryptionSaltKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'pre_generated_encryption_salts',

  enums: {},

  findById: function (id) {
    var oThis = this;
    return oThis.QueryDB.read(oThis.tableName, [], 'id=?', [id]);
  }

};

Object.assign(PreGeneratedEncryptionSaltKlass.prototype, PreGeneratedEncryptionSaltKlassPrototype);

module.exports = PreGeneratedEncryptionSaltKlass;