"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , managedAddressKlass = require(rootPrefix + '/app/models/managed_address')
    , AddressEncryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor')
;

/**
 * @constructor
 * @augments EthAddrPrivateKeyCacheKlass
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const EthAddrPrivateKeyCacheKlass = module.exports = function(params) {

  const oThis = this;

  oThis.address = params['address'];

  baseCache.call(this, params);

};

EthAddrPrivateKeyCacheKlass.prototype = Object.create(baseCache.prototype);

EthAddrPrivateKeyCacheKlass.prototype.constructor = EthAddrPrivateKeyCacheKlass;

/**
 * set cache key
 *
 * @return {String}
 */
EthAddrPrivateKeyCacheKlass.prototype.setCacheKey = function() {

  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + "eth_a_p_k_" + oThis.address ;

  return oThis.cacheKey;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
EthAddrPrivateKeyCacheKlass.prototype.setCacheExpiry = function() {

  const oThis = this;

  oThis.cacheExpiry = 86400; // 24 hours

  return oThis.cacheExpiry;

};

/**
 * fetch data from source and return eth balance from VC in Wei
 *
 * @return {Result}
 */
EthAddrPrivateKeyCacheKlass.prototype.fetchDataFromSource = async function() {

  const oThis = this
      ,  managedAddressObj = new managedAddressKlass();

  const managedAddresses = await managedAddressObj.getByEthAddressesSecure([oThis.address])
      , managedAddress = managedAddresses[0];

  if(!managedAddress){
    return responseHelper.error("cm_mas_1", "Address invalid.");
  }

  return responseHelper.successWithData({
    managed_address_salt_id: managedAddress.managed_address_salt_id,
    private_key_e: managedAddress.private_key
  });

};

/**
 * fetch data from cache and decrypt
 *
 * @return {Result}
 */
EthAddrPrivateKeyCacheKlass.prototype.fetchDecryptedData = async function () {

  const oThis = this;

  const fetchFromCacheRsp = await oThis.fetch();

  if (fetchFromCacheRsp.isFailure()) {
    return fetchFromCacheRsp;
  }

  const cachedResponse = fetchFromCacheRsp.data;

  var encrObj = new AddressEncryptorKlass({'managedAddressSaltId': cachedResponse.managed_address_salt_id});

  return responseHelper.successWithData({
    private_key_d: await encrObj.decrypt(cachedResponse['private_key_e'])
  });

};