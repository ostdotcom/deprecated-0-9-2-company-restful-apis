'use strict';

/**
 * Client specific OpenStCache Provider
 *
 * @module lib/providers/client_specific_cache_factory
 */

const rootPrefix = '../..',
  OpenStCache = require('@openstfoundation/openst-cache'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * Constructor
 *
 * @constructor
 */
const CacheProviderKlass = function(configStrategy, instanceComposer) {};

CacheProviderKlass.prototype = {
  /**
   * Get provider
   *
   * @return {object}
   */
  getInstance: function(cacheType, cacheConsistentBehavior) {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    let cacheConfigStrategy = null;

    if (cacheManagementConst.memcached === cacheType) {
      cacheConfigStrategy = {
        OST_CACHING_ENGINE: cacheManagementConst.memcached,
        OST_MEMCACHE_SERVERS: configStrategy.OST_MEMCACHE_SERVERS
      };
    } else if (cacheManagementConst.redis === cacheType) {
      cacheConfigStrategy = {
        OST_CACHING_ENGINE: cacheManagementConst.redis,
        OST_REDIS_HOST: configStrategy.OST_REDIS_HOST,
        OST_REDIS_PORT: configStrategy.OST_REDIS_PORT,
        OST_REDIS_PASS: configStrategy.OST_REDIS_PASS,
        OST_REDIS_TLS_ENABLED: configStrategy.OST_REDIS_TLS_ENABLED
      };
    } else {
      throw `client_specific_cache_factory: Invalid cache type: ${cacheType}`;
    }
    cacheConfigStrategy.OST_DEFAULT_TTL = configStrategy.OST_DEFAULT_TTL;
    cacheConfigStrategy.OST_CACHE_CONSISTENT_BEHAVIOR = cacheConsistentBehavior;

    return OpenStCache.getInstance(cacheConfigStrategy);
  }
};

InstanceComposer.register(CacheProviderKlass, 'getClientSpecificCacheProvider', true);

module.exports = new CacheProviderKlass();
