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

    // We are still using cacheType parameter as we might need to add some other client specific cache provider later on.
    if (cacheManagementConst.memcached === cacheType) {
      cacheConfigStrategy = {
        OST_CACHING_ENGINE: cacheManagementConst.memcached,
        OST_MEMCACHE_SERVERS: configStrategy.OST_MEMCACHE_SERVERS
      };
    } else {
      throw 'Invalid cache type.';
    }
    cacheConfigStrategy.OST_DEFAULT_TTL = configStrategy.OST_DEFAULT_TTL;
    cacheConfigStrategy.OST_CACHE_CONSISTENT_BEHAVIOR = cacheConsistentBehavior;

    return OpenStCache.getInstance(cacheConfigStrategy);
  }
};

InstanceComposer.register(CacheProviderKlass, 'getClientSpecificCacheProvider', true);

module.exports = new CacheProviderKlass();
