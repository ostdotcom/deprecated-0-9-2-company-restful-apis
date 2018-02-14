"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , clientAddressSaltCacheKlass = require(rootPrefix + '/lib/cache_management/client_address_salt')
  , localCipher = require(rootPrefix + '/lib/authentication/local_cipher')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
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
  },

  getClientDecryptedSalt: async function(clientId) {
    var obj = new clientAddressSaltCacheKlass({client_id: clientId});
    var cachedResponse = await obj.fetch();
    if (cachedResponse.isFailure()) {
      return cachedResponse;
    }

    var addrSalt = await localCipher.decrypt(coreConstants.CACHE_SHA_KEY, cachedResponse.data.addressSalt);
    return responseHelper.successWithData({addressSalt: addrSalt});
  }

};

Object.assign(ManagedAddressSaltKlass.prototype, ManagedAddressSaltKlassPrototype);

module.exports = ManagedAddressSaltKlass;