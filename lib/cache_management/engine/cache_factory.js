'use strict';

//Load external files
const rootPrefix = '../../..',
  openStCache = require('@openstfoundation/openst-cache'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * Constructor for Cache Implementer
 *
 * @constructor
 */
const CacheImplementerFactory = function(configStrategies, instanceComposer) {};

CacheImplementerFactory.prototype = {
  /**
   * Get cache provider
   *
   * @param {string} cacheType - type of cache.
   * @returns {string} cacheConsistentBehavior - consistency of cache behavior.
   *
   */
  getCacheImplementer: function(cacheType, cacheConsistentBehavior) {
    const oThis = this;

    let configStrategy = oThis.ic().configStrategy;
    let cacheConfigStrategy = null;

    if (cacheManagementConst.memcached === cacheType) {
      cacheConfigStrategy = {
        OST_CACHING_ENGINE: cacheManagementConst.memcached,
        OST_MEMCACHE_SERVERS: configStrategy.OST_MEMCACHE_SERVERS
      };
    } else if (cacheManagementConst.in_memory === cacheType) {
      cacheConfigStrategy = {
        OST_CACHING_ENGINE: 'none'
      };
    } else if (cacheManagementConst.shared_memcached === cacheType) {
      cacheConfigStrategy = {
        OST_CACHING_ENGINE: cacheManagementConst.memcached,
        OST_MEMCACHE_SERVERS: coreConstants.SHARED_MEMCACHE_SERVERS
      };
    } else if (cacheManagementConst.redis === cacheType) {
      cacheConfigStrategy = {
        OST_CACHING_ENGINE: cacheManagementConst.redis,
        OST_REDIS_HOST: configStrategy.OST_REDIS_HOST,
        OST_REDIS_PORT: configStrategy.OST_REDIS_PORT,
        OST_REDIS_PASS: configStrategy.OST_REDIS_PASS
      };
    } else {
      throw 'Invalid cache type.';
    }
    cacheConfigStrategy.OST_DEFAULT_TTL = configStrategy.OST_DEFAULT_TTL;
    cacheConfigStrategy.OST_CACHE_CONSISTENT_BEHAVIOR = cacheConsistentBehavior;

    return openStCache.getInstance(cacheConfigStrategy).cacheInstance;
  }
};

InstanceComposer.register(CacheImplementerFactory, 'getCacheImplementerFactory', true);

module.exports = new CacheImplementerFactory();
