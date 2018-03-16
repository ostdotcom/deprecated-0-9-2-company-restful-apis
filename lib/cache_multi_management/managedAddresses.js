"use strict";

const rootPrefix = '../..'
  , baseCache = require(rootPrefix + '/lib/cache_multi_management/base')
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
const managedAddressCache = module.exports = function (params) {

  const oThis = this;

  oThis.uuids = params['uuids'];

  baseCache.call(this, params);

  oThis.useObject = true;

};

managedAddressCache.prototype = Object.create(baseCache.prototype);

managedAddressCache.prototype.constructor = managedAddressCache;

/**
 * set cache key
 *
 * @return {Object}
 */
managedAddressCache.prototype.setCacheKeys = function () {

  const oThis = this;

  oThis.cacheKeys = {};
  for (var i = 0; i < oThis.uuids.length; i++) {
    oThis.cacheKeys[oThis._cacheKeyPrefix() + "cma_ma_u_" + oThis.uuids[i]] = oThis.uuids[i];
  }

  return oThis.cacheKeys;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
managedAddressCache.prototype.setCacheExpiry = function () {

  const oThis = this;

  oThis.cacheExpiry = 300 // 5 minutes ;

  return oThis.cacheExpiry;

};

/**
 * fetch data from source
 *
 * @return {Result}
 */
managedAddressCache.prototype.fetchDataFromSource = async function (cacheIds) {

  const oThis = this;

  if (!cacheIds) {
    return responseHelper.error(
      'cmm_ma_1', 'blank uuids'
    );
  }

  const queryResponse = await managedAddress.getByUuids(cacheIds);

  if (!queryResponse) {
    return responseHelper.error(
      'cmm_ma_2', 'No Data found'
    );
  }

  var formattedResponse = {};
  for (var i = 0; i < queryResponse.length; i++) {
    var rawResponse = queryResponse[i];
    formattedResponse[rawResponse.uuid] = {
      'client_id': rawResponse.client_id,
      'name': rawResponse.name,
      'id': rawResponse.id,
      'managed_address_salt_id': rawResponse.managed_address_salt_id,
      'ethereum_address': rawResponse.ethereum_address,
      'private_key_e': rawResponse.private_key,
      'passphrase_d': 'no_password', // as for these addresses we use private keys send dummy passowrd to bypass Platform validation
      'properties': managedAddress.getAllBits('properties', rawResponse.properties),
      'status': managedAddress.statuses[rawResponse.status]
    };
  }

  return responseHelper.successWithData(formattedResponse);

};

/**
 * fetch data from cache and decrypt said properties
 *
 * @param {Array}
 *
 * @return {Result}
 */
managedAddressCache.prototype.fetchDecryptedData = async function (properties) {

  const oThis = this;

  const fetchFromCacheRsp = await oThis.fetch();

  if (fetchFromCacheRsp.isFailure()) {
    return fetchFromCacheRsp;
  }

  const dataFromCache = fetchFromCacheRsp.data
    , cacheKeys = Object.keys(dataFromCache);

  if (cacheKeys.length == 0 || (typeof properties !== 'object') || !Array.isArray(properties)) {
    return responseHelper.successWithData(dataFromCache);
  }

  const cachedResponse = util.clone(dataFromCache);// this is to prevent inmemory cache not modifiying the cache object with decrtpyed value


  if (properties.includes('private_key')) {
    for (var i = 0; i < cacheKeys.length; i++) {
      var encrObj = new AddressEncryptorKlass({'managedAddressSaltId': cachedResponse[cacheKeys[i]].managed_address_salt_id});
      cachedResponse[cacheKeys[i]]['private_key_d'] = await encrObj.decrypt(cachedResponse[cacheKeys[i]]['private_key_e']);
    }
  }

  return responseHelper.successWithData(cachedResponse);

};