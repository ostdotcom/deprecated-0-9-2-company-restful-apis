"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , openStPlatform = require('@openstfoundation/openst-platform')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * @constructor
 * @augments ostPrimeBalanceCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ostPrimeBalanceCache = module.exports = function(params) {

  const oThis = this;

  oThis.address = params['address'];

  baseCache.call(this, params);

};

ostPrimeBalanceCache.prototype = Object.create(baseCache.prototype);

ostPrimeBalanceCache.prototype.constructor = ostPrimeBalanceCache;

/**
 * set cache key
 *
 * @return {String}
 */
ostPrimeBalanceCache.prototype.setCacheKey = function() {

  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + "bal_ost_p_" + oThis.address ;

  return oThis.cacheKey;

};

/**
 * fetch data from source and return OST Prime balance from UC in Wei
 *
 * @return {Result}
 */
ostPrimeBalanceCache.prototype.fetchDataFromSource = async function() {

  const oThis = this;

  const obj = new openStPlatform.services.balance.simpleTokenPrime({'address': oThis.address});

  const response = await obj.perform();

  if (response.isFailure()) {
    return response;
  } else {
    return responseHelper.successWithData(response.data['balance']);
  }

};