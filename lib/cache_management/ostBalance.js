'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  openStPlatform = require('@openstfoundation/openst-platform'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

/**
 * @constructor
 * @augments ostBalanceCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ostBalanceCache = (module.exports = function(params) {
  const oThis = this;

  oThis.address = params['address'];

  baseCache.call(this, params);
});

ostBalanceCache.prototype = Object.create(baseCache.prototype);

ostBalanceCache.prototype.constructor = ostBalanceCache;

/**
 * set cache key
 *
 * @return {String}
 */
ostBalanceCache.prototype.setCacheKey = function() {
  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + 'bal_ost_' + oThis.address;

  return oThis.cacheKey;
};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
ostBalanceCache.prototype.setCacheExpiry = function() {
  const oThis = this;

  oThis.cacheExpiry = 60; // 1 minute ;

  return oThis.cacheExpiry;
};

/**
 * fetch data from source and return OST balance from VC in Wei
 *
 * @return {Result}
 */
ostBalanceCache.prototype.fetchDataFromSource = async function() {
  const oThis = this;

  const obj = new openStPlatform.services.balance.simpleToken({ address: oThis.address });

  const response = await obj.perform();

  if (response.isFailure()) {
    return response;
  } else {
    return responseHelper.successWithData(response.data['balance']);
  }
};
