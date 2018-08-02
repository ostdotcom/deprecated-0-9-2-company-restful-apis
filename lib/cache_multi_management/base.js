'use strict';

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  util = require(rootPrefix + '/lib/util'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management');

require(rootPrefix + '/lib/cache_management/engine/cache_factory');

/**
 * constructor
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 * @constructor
 */
const BaseCacheMultiManagementKlass = function(params) {
  const oThis = this;

  if (!params) {
    params = {};
  }

  oThis.params = params;

  oThis.cacheKeys = {};

  // Set cacheImplementer to perform caching operations
  oThis.cacheImplementer = oThis
    .ic()
    .getCacheImplementerFactory()
    .getCacheImplementer(oThis.cacheType, oThis.consistentBehavior);

  // call sub class method to set cache keys using params provided
  oThis.setCacheKeys();
};

BaseCacheMultiManagementKlass.prototype = {
  /**
   * Get appropriate cacheImplementer based on cache type.
   *
   * @returns {*}
   */
  getCacheImplementer: function() {
    const oThis = this;

    let configStrategy = null;
    if (oThis.cacheType === cacheManagementConst.memcached) {
      configStrategy = {
        OST_CACHING_ENGINE: coreConstants.SAAS_ONLY_SHARED_CACHE_ENGINE,
        OST_MEMCACHE_SERVERS: coreConstants.MEMCACHE_SERVERS,
        OST_CACHE_CONSISTENT_BEHAVIOR: 0
      };
    } else if (oThis.cacheType === cacheManagementConst.none) {
      configStrategy = {
        OST_CACHING_ENGINE: 'none',
        OST_CACHE_CONSISTENT_BEHAVIOR: 1
      };
    } else if (oThis.cacheType === cacheManagementConst.shared_memcached) {
      configStrategy = oThis.ic().configStrategy;
    }

    return openStCache.getInstance(configStrategy).cacheInstance;
  },

  /**
   * Fetch data from cache, in case of cache miss calls sub class method to fetch data from source
   *
   * @return {Promise<Result>} - On success, data.value has value. On failure, error details returned.
   */
  fetch: async function() {
    const oThis = this;

    var data = await oThis._fetchFromCache(),
      fetchDataRsp = null;

    // if there are any cache misses then fetch that data from source.
    if (data['cacheMiss'].length > 0) {
      fetchDataRsp = await oThis.fetchDataFromSource(data['cacheMiss']);

      // if fetch from source failed do not set cache and return error response
      if (fetchDataRsp.isFailure()) {
        logger.notify('cmm_b_1', 'Something Went Wrong', fetchDataRsp);

        return fetchDataRsp;
      } else {
        // DO NOT WAIT for cache being set
        var cache_keys = Object.keys(fetchDataRsp.data);
        for (var i = 0; i < cache_keys.length; i++) {
          var key = cache_keys[i];
          var dataToSet = fetchDataRsp.data[key];
          data['cachedData'][key] = dataToSet;
          oThis._setCache(key, dataToSet);
        }
      }
    }

    return Promise.resolve(responseHelper.successWithData(data['cachedData']));
  },

  /**
   * clear cache
   *
   * @return {Promise<Result>}
   */
  clear: function() {
    const oThis = this;

    for (var i = 0; i < Object.keys(oThis.cacheKeys).length; i++) {
      var cacheKey = Object.keys(oThis.cacheKeys)[i];
      oThis.cacheImplementer.del(cacheKey);
    }
  },

  // methods which sub class would have to implement

  /**
   * set cache keys in oThis.cacheKeys and return it
   *
   * @return {String}
   */
  setCacheKeys: function() {
    throw 'sub class to implement';
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    throw 'sub class to implement';
  },

  /**
   * fetch data from source
   * return should be of klass Result
   * data attr of return is returned and set in cache
   *
   * @return {Result}
   */
  fetchDataFromSource: async function(cacheIds) {
    throw 'sub class to implement';
  },

  // private methods from here

  /**
   * fetch from cache
   *
   * @return {Object}
   */
  _fetchFromCache: async function() {
    const oThis = this;
    var cacheFetchResponse = null,
      cache_keys = Object.keys(oThis.cacheKeys);

    cacheFetchResponse = await oThis.cacheImplementer.multiGet(cache_keys);
    var cache_miss = [],
      cachedResponse = {};

    if (cacheFetchResponse.isSuccess()) {
      var cachedData = cacheFetchResponse.data.response;
      for (var i = 0; i < cache_keys.length; i++) {
        var cacheKey = cache_keys[i];
        if (cachedData[cacheKey]) {
          cachedResponse[oThis.cacheKeys[cacheKey]] = JSON.parse(cachedData[cacheKey]);
        } else {
          cache_miss.push(oThis.cacheKeys[cacheKey]);
        }
      }
    } else {
      logger.error('==>Error while getting from cache: ', cacheFetchResponse);
      for (var i = 0; i < cache_keys.length; i++) {
        var cacheKey = cache_keys[i];
        cache_miss.push(oThis.cacheKeys[cacheKey]);
      }
    }

    return { cacheMiss: cache_miss, cachedData: cachedResponse };
  },

  /**
   * set data in cache.
   *
   * @param {Object} dataToSet - data to se tin cache
   *
   * @return {Result}
   */
  _setCache: function(key, dataToSet) {
    const oThis = this;

    var setCacheFunction = function(k, v) {
      var cacheKey = util.invert(oThis.cacheKeys)[k];
      return oThis.cacheImplementer.set(cacheKey, JSON.stringify(v), oThis.cacheExpiry);
    };

    setCacheFunction(key, dataToSet).then(function(cacheSetResponse) {
      if (cacheSetResponse.isFailure()) {
        logger.notify('cmm_b_2', 'Something Went Wrong', cacheSetResponse);
      }
    });
  },

  /**
   * cache key prefix
   *
   * @return {String}
   */
  _cacheKeyPrefix: function() {
    return 'saas_' + coreConstants.ENVIRONMENT_SHORT + '_' + coreConstants.SUB_ENVIRONMENT_SHORT + '_';
  }
};

InstanceComposer.registerShadowableClass(BaseCacheMultiManagementKlass, 'getBaseCacheMultiManagement');

module.exports = BaseCacheMultiManagementKlass;
