'use strict';

/**
 * Memcached cache instance provider which is not client specific.
 *
 * @module lib/providers/shared_memcached
 */

const rootPrefix = '../..',
  OpenStCache = require('@openstfoundation/openst-cache'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management');

/**
 * Constructor
 *
 * @constructor
 */
const SharedMemcachedCacheProviderKlass = function() {};

SharedMemcachedCacheProviderKlass.prototype = {
  /**
   * get provider
   *
   * @return {object}
   */
  getInstance: function(cacheConsistentBehavior) {
    const cacheConfigStrategy = {
      OST_CACHING_ENGINE: cacheManagementConst.memcached,
      OST_MEMCACHE_SERVERS: coreConstants.SHARED_MEMCACHE_SERVERS,
      OST_DEFAULT_TTL: '86400', //24 hours
      OST_CACHE_CONSISTENT_BEHAVIOR: cacheConsistentBehavior
    };
    //TODO: Maybe add extra env var for default TTL.

    return OpenStCache.getInstance(cacheConfigStrategy);
  }
};

module.exports = new SharedMemcachedCacheProviderKlass();
