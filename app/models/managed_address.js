"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , localCipher = require(rootPrefix + '/lib/authentication/local_cipher')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , addressSaltCacheKlass = require(rootPrefix + '/lib/cache_management/managedAddressesSalt')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

const dbName = "saas_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
  , statuses = {'1':'active', '2':'inactive'}
  , invertedStatuses = util.invert(statuses)
;

const ManagedAddressKlass = function () {};

ManagedAddressKlass.prototype = Object.create(ModelBaseKlass.prototype);

const ManagedAddressKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'managed_addresses',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  enums: {
    'status': {
      val: statuses,
      inverted: invertedStatuses
    }
  },

  getByEthAddress: function (ethAddress) {
    var oThis = this;
    var hashedAddr = localCipher.getShaHashedText(ethAddress);
    return oThis.QueryDB.read(
      oThis.tableName,
      [],
      'hashed_ethereum_address=?',
      [hashedAddr]);
  },

  getByIds: function (ids) {
    var oThis = this;
    return oThis.QueryDB.readByIds(
      oThis.tableName,
      ['id', 'ethereum_address'],
      ids);
  },

  getByUuid: function (uuid) {
    var oThis = this;
    return oThis.QueryDB.read(
        oThis.tableName,
        ['client_id', 'name','ethereum_address', 'hashed_ethereum_address', 'passphrase', 'status'],
        'uuid=?',
        [uuid]);
  },

  getDecryptedSalt: async function(clientId){
    var obj = new addressSaltCacheKlass({client_id: clientId});
    var saltObj = await obj.fetch();
    if(saltObj.isFailure()){
      return saltObj;
    }
    var salt = await localCipher.decrypt(coreConstants.CACHE_SHA_KEY, saltObj.data.addressSalt);
    return responseHelper.successWithData({addressSalt: salt});
  }

};

Object.assign(ManagedAddressKlass.prototype, ManagedAddressKlassPrototype);

module.exports = ManagedAddressKlass;