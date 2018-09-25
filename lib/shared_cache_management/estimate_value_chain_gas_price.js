'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/shared_cache_management/base'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management');

/**
 * @constructor
 * @augments baseCache
 */
const EstimateValueChainGasPriceCacheKlass = function() {
  const oThis = this;

  oThis.cacheType = cacheManagementConst.shared_memcached;
  oThis.consistentBehavior = '1';

  baseCache.call(this, {});
  oThis.useObject = false;
};

EstimateValueChainGasPriceCacheKlass.prototype = Object.create(baseCache.prototype);

const EstimateValueChainGasPriceCachePrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'c_evc_gp';

    return oThis.cacheKey;
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    const oThis = this;

    oThis.cacheExpiry = 600; // 10 minutes

    return oThis.cacheExpiry;
  },

  /**
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {
    const oThis = this;

    let gasPriceToBeSubmittedHex = coreConstants.DEFAULT_VALUE_GAS_PRICE; //DEFAULT_VALUE_GAS_PRICE is in hex
    return Promise.resolve(responseHelper.successWithData(gasPriceToBeSubmittedHex));
  }
};

Object.assign(EstimateValueChainGasPriceCacheKlass.prototype, EstimateValueChainGasPriceCachePrototype);

module.exports = EstimateValueChainGasPriceCacheKlass;
