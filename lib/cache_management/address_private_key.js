'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  managedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  AddressEncryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const EthAddrPrivateKeyCacheKlass = function(params) {
  const oThis = this;

  oThis.address = params['address'];
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '1';

  baseCache.call(oThis, params);
};

EthAddrPrivateKeyCacheKlass.prototype = Object.create(baseCache.prototype);

const EthAddrPrivateKeyCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'eth_a_p_k_' + oThis.address;

    return oThis.cacheKey;
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    const oThis = this;

    oThis.cacheExpiry = 86400; // 24 hours

    return oThis.cacheExpiry;
  },

  /**
   * fetch data from source and return eth balance from VC in Wei
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {
    const oThis = this;

    const managedAddresses = await new managedAddressModel().getByEthAddressesSecure([oThis.address]),
      managedAddress = managedAddresses[0];

    if (!managedAddress) {
      return responseHelper.error({
        internal_error_identifier: 'cm_apk_1',
        api_error_identifier: 'address_invalid',
        error_config: errorConfig
      });
    }

    return Promise.resolve(
      responseHelper.successWithData({
        managed_address_salt_id: managedAddress.managed_address_salt_id,
        private_key_e: managedAddress.private_key
      })
    );
  },

  /**
   * fetch data from cache and decrypt
   *
   * @return {Result}
   */
  fetchDecryptedData: async function() {
    const oThis = this;

    const fetchFromCacheRsp = await oThis.fetch();

    if (fetchFromCacheRsp.isFailure()) {
      return fetchFromCacheRsp;
    }

    const cachedResponse = fetchFromCacheRsp.data;

    let encrObj = new AddressEncryptorKlass({ managedAddressSaltId: cachedResponse.managed_address_salt_id });

    return Promise.resolve(
      responseHelper.successWithData({
        private_key_d: await encrObj.decrypt(cachedResponse['private_key_e'])
      })
    );
  }
};

Object.assign(EthAddrPrivateKeyCacheKlass.prototype, EthAddrPrivateKeyCacheKlassPrototype);

InstanceComposer.registerShadowableClass(EthAddrPrivateKeyCacheKlass, 'getEthAddrPrivateKeyCache');

module.exports = EthAddrPrivateKeyCacheKlass;
