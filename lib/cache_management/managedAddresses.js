"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , managedAddress = new ManagedAddressKlass()
    , AddressEncryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , basicHelper = require(rootPrefix + '/helpers/basic')
    , util = require(rootPrefix + '/lib/util')
;

/**
 * @constructor
 * @augments managedAddressCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const managedAddressCache = module.exports = function(params) {

  const oThis = this;

  oThis.addressUuid = params['addressUuid'];

  baseCache.call(this, params);

};

managedAddressCache.prototype = Object.create(baseCache.prototype);

managedAddressCache.prototype.constructor = managedAddressCache;

/**
 * set cache key
 *
 * @return {String}
 */
managedAddressCache.prototype.setCacheKey = function() {

  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + "ma_u_" + oThis.addressUuid ;

  return oThis.cacheKey;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
managedAddressCache.prototype.setCacheExpiry = function() {

  const oThis = this;

  oThis.cacheExpiry = 300 // 5 minutes ;

  return oThis.cacheExpiry;

};

/**
 * fetch data from source
 *
 * @return {Result}
 */
managedAddressCache.prototype.fetchDataFromSource = async function() {

  const oThis = this;

  if (!oThis.addressUuid) {
    return responseHelper.error(
        'cm_ma_1', 'blank uuid'
    );
  }

  const queryResponse = await managedAddress.getByUuid(oThis.addressUuid)
  , rawResponse = queryResponse[0];

  if (!rawResponse) {
    return responseHelper.error(
        'cm_ma_2', 'UUID not found'
    );
  }

  const formattedResponse = {
    'client_id': rawResponse.client_id,
    'name': rawResponse.name,
    'ethereum_address': rawResponse.ethereum_address,
    'passphrase_e': rawResponse.passphrase
  };

  return responseHelper.successWithData(formattedResponse);

};

/**
 * fetch data from cache and decrypt said properties
 *
 * @param {Array}
 *
 * @return {Result}
 */
managedAddressCache.prototype.fetchDecryptedData = async function(properties) {

  const oThis = this;

  const fetchFromCacheRsp = await oThis.fetch();

  if (fetchFromCacheRsp.isFailure()) {
    return fetchFromCacheRsp;
  }

  const dataFromCache = fetchFromCacheRsp.data;

  if ((typeof properties !== 'object') || !Array.isArray(properties)) {
    return responseHelper.successWithData(dataFromCache);
  }

  const responseData = util.clone(dataFromCache) // this is to prevent inmemory cache not modifiying the cache object with decrtpyed values
      , encrObj = new AddressEncryptorKlass(dataFromCache.client_id);


  if (properties.includes('passphrase')) {
    responseData['passphrase_d'] = await encrObj.decrypt(responseData['passphrase_e']);
  }

  return responseHelper.successWithData(responseData);

};