'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  CurrencyConversionRateModel = require(rootPrefix + '/app/models/currency_conversion_rate'),
  conversionRatesConst = require(rootPrefix + '/lib/global_constant/conversion_rates'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  allMemcacheInstanceKlass = require(rootPrefix + '/lib/shared_cache_management/all_memcache_instance'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * @constructor
 * @augments baseCache
 */
const OstPricePointsCacheKlass = function() {
  const oThis = this;
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '1';

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
    oThis.cacheKey = oThis._sharedCacheKeyPrefix() + 'c_ost_pp';

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
  clear: function() {
    const oThis = this;

    const allMemcacheInstance = new allMemcacheInstanceKlass();
    allMemcacheInstance.clearCache(
      coreConstants.SHARED_MEMCACHE_KEY_PREFIX + coreConstants.ENVIRONMENT_SHORT + '_sa_c_ost_pp_1'
    );

    return oThis.cacheImplementer.del(oThis.cacheKey);
  },

  /**
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {
    const oThis = this;

    let cacheData = {},
      hasData = false;
    cacheData[conversionRatesConst.ost_currency()] = {};
    for (let key in new CurrencyConversionRateModel().quote_currency) {
      let currencyCode = new CurrencyConversionRateModel().quote_currency[key];

      let response = await new CurrencyConversionRateModel().getLastActiveRates(currencyCode);
      if (response[0]) {
        hasData = true;
        cacheData[conversionRatesConst.ost_currency()][currencyCode] = response[0].conversion_rate;
      }
    }
    if (!hasData) {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'c_ostpp_1',
          api_error_identifier: 'invalid_params',
          error_config: errorConfig
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData(cacheData));
  }
};

Object.assign(OstPricePointsCacheKlass.prototype, OstPricePointsCacheKlassPrototype);

InstanceComposer.registerShadowableClass(OstPricePointsCacheKlass, 'getOstPricePointsCache');

module.exports = OstPricePointsCacheKlass;
