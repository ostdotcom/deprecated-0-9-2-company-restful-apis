"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , openStPlatform = require('@openstfoundation/openst-platform')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * @constructor
 * @augments ethBalanceCache
 *
 * @param {Array} values - array of primary keys which form memcache key
 * @param {Object} options - extra params which go into cache key
 *
 */
const ethBalanceCache = module.exports = function(params) {

  const oThis = this;

  oThis.address = params['address'];

  baseCache.call(this, params);

};

ethBalanceCache.prototype = Object.create(baseCache.prototype);

ethBalanceCache.prototype.constructor = ethBalanceCache;

/**
 * set cache key
 *
 * @return {String}
 */
ethBalanceCache.prototype.setCacheKey = function() {

  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + "eb_" + oThis.address ;

  return oThis.cacheKey;

};

/**
 * fetch data from source
 *
 * @return {Result}
 */
ethBalanceCache.prototype.fetchDataFromSource = async function() {

  const oThis = this;

  const obj = new openStPlatform.services.balance.eth({'address': oThis.address});

  const response = await obj.perform();

  if (response.isFailure()) {
    return response;
  } else {
    return responseHelper.successWithData(response.data['balance']);
  }

};