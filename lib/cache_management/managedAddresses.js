"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
    , managedAddressSalt = new ManagedAddressKlass()
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
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
 * fetch data from source and return eth balance from VC in Wei
 *
 * @return {Result}
 */
managedAddressCache.prototype.fetchDataFromSource = async function() {

  const oThis = this;

  const response = await managedAddressSalt.getByUuid(oThis.addressUuid);

  return responseHelper.successWithData(response[0]);

};