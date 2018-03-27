"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , currencyConversionRateModel = require(rootPrefix + '/app/models/currency_conversion_rate')
    , conversionRatesConst = require(rootPrefix + '/lib/global_constant/conversion_rates')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , allMemcacheInstanceKlass = require(rootPrefix + '/lib/cache_management/all_memcache_instance')
;

/**
 * @constructor
 * @augments OstPricePointsCacheKlass
 *
 *
 */
const OstPricePointsCacheKlass = function() {

  const oThis = this;

  baseCache.call(this, {});

  oThis.useObject = true;

};

OstPricePointsCacheKlass.prototype = Object.create(baseCache.prototype);

const OstPricePointsCacheKlassPrototype = {

  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {

    const oThis = this;

    // It uses shared cache key between company api and saas.
    oThis.cacheKey = oThis._sharedCacheKeyPrefix() + "c_ost_pp";

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
   * clear cache
   *
   * @return {Promise<Result>}
   */
  clear: function () {

    const oThis = this;

    const allMemcacheInstance = new allMemcacheInstanceKlass();
    allMemcacheInstance.clearCache(coreConstants.SHARED_MEMCACHE_KEY_PREFIX + coreConstants.ENVIRONMENT_SHORT + '_sa_c_ost_pp_1');

    return oThis.cacheImplementer.del(oThis.cacheKey);

  },

  /**
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {

    const oThis = this;

    var cacheData = {},
        hasData = false;
    cacheData[conversionRatesConst.ost_currency()] = {};
    for(var key in currencyConversionRateModel.quote_currency){
      var currencyCode = currencyConversionRateModel.quote_currency[key];

      var response = await currencyConversionRateModel.getLastActiveRates(currencyCode);
      if(response[0]) {
        hasData = true;
        cacheData[conversionRatesConst.ost_currency()][currencyCode] = response[0].conversion_rate;
      }
    }
    if(!hasData){
      return Promise.resolve(responseHelper.error("c_ostpp_1", "No data found."));
    }

    return Promise.resolve(responseHelper.successWithData(cacheData));

  }

};

Object.assign(OstPricePointsCacheKlass.prototype, OstPricePointsCacheKlassPrototype);

module.exports = OstPricePointsCacheKlass;