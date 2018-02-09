"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
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

  oThis.cacheKey = oThis._cacheKeyPrefix() + "eb_" + oThis.params['address'] ;

  return oThis.cacheKey;

};

/**
 * fetch data from source
 *
 * @return {BigNumber}
 */
ethBalanceCache.prototype.fetchDataFromSource = function() {

  const oThis = this;

  return 21212;

};