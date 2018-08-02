'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  ManagedAddressSaltModel = require(rootPrefix + '/app/models/managed_address_salt'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * @constructor
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ClientAddressSaltMappingKlass = function(params) {
  const oThis = this;

  oThis.clientId = params['client_id'];
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '1';

  baseCache.call(oThis, params);

  oThis.useObject = false;
};

ClientAddressSaltMappingKlass.prototype = Object.create(baseCache.prototype);

const ClientAddressSaltMappingKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'c_adr_sm_' + oThis.clientId;

    return oThis.cacheKey;
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    const oThis = this;

    oThis.cacheExpiry = 1800; // 30 minutes

    return oThis.cacheExpiry;
  },
  /**
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {
    const oThis = this,
      response = await new ManagedAddressSaltModel()
        .select('id')
        .where(['client_id = ?', oThis.clientId])
        .order_by({ id: 'DESC' })
        .limit(1)
        .fire();

    var saltId = response.length > 0 ? response[0].id : 0;

    return Promise.resolve(responseHelper.successWithData({ clientAddrSalt: saltId }));
  }
};

Object.assign(ClientAddressSaltMappingKlass.prototype, ClientAddressSaltMappingKlassPrototype);

InstanceComposer.registerShadowableClass(ClientAddressSaltMappingKlass, 'getClientAddressSaltMapping');

module.exports = ClientAddressSaltMappingKlass;
