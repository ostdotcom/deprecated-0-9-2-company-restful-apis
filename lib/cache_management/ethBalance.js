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
 * @param {Object} params - cache key generation & expiry related params
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

  oThis.cacheKey = oThis._cacheKeyPrefix() + "bal_e_" + oThis.address ;

  return oThis.cacheKey;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
ethBalanceCache.prototype.setCacheExpiry = function() {

  const oThis = this;

  oThis.cacheExpiry = 300; // 5 minutes

  return oThis.cacheExpiry;

};

/**
 * fetch data from source and return eth balance from VC in Wei
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