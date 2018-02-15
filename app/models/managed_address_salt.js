"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
;

const dbName = "saas_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
;

const ManagedAddressSaltKlass = function () {};

ManagedAddressSaltKlass.prototype = Object.create(ModelBaseKlass.prototype);

const ManagedAddressSaltKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'managed_address_salts',

  enums: {},

  getByClientId: function (clientId) {
    var oThis = this;
    return oThis.QueryDB.read(
      oThis.tableName,
      [],
      'client_id=?',
      [clientId]);
  }

};

Object.assign(ManagedAddressSaltKlass.prototype, ManagedAddressSaltKlassPrototype);

module.exports = ManagedAddressSaltKlass;