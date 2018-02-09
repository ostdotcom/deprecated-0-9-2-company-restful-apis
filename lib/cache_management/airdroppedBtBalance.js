"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * @constructor
 * @augments airdroppedBtBalanceCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const airdroppedBtBalanceCache = module.exports = function(params) {

  const oThis = this;

  oThis.address = params['address'];
  oThis.clientTokenId = params['client_token_id'];

  baseCache.call(this, params);

};

airdroppedBtBalanceCache.prototype = Object.create(baseCache.prototype);

airdroppedBtBalanceCache.prototype.constructor = airdroppedBtBalanceCache;

/**
 * set cache key
 *
 * @return {String}
 */
airdroppedBtBalanceCache.prototype.setCacheKey = function() {

  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + "bal_abt_" + oThis.clientTokenId + '_' + oThis.address ;

  return oThis.cacheKey;

};

/**
 * fetch data from source and return airdropped token balance in Wei
 *
 * @return {Result}
 */
airdroppedBtBalanceCache.prototype.fetchDataFromSource = async function() {

  const oThis = this;

  //TODO: Implement logic here to fetch from source
  return responseHelper.successWithData('10000000000000000000')

};