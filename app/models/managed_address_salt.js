"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
;

const dbName = "saas_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
;

const ManagedAddressSaltKlass = function () {
  ModelBaseKlass.call(this, {dbName: dbName});
};

ManagedAddressSaltKlass.prototype = Object.create(ModelBaseKlass.prototype);

const ManagedAddressSaltKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'managed_address_salts',

  enums: {},

  getById: function (id) {
    var oThis = this;
    return oThis.QueryDB.read(
      oThis.tableName,
      [],
      'id=?',
      [id]);
  }

};

Object.assign(ManagedAddressSaltKlass.prototype, ManagedAddressSaltKlassPrototype);

module.exports = ManagedAddressSaltKlass;