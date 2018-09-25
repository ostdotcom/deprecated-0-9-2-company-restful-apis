'use strict';

/**
 * Redis cache instance provider.
 *
 * @module lib/providers/shared_redis
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
const SharedRedisCacheProviderKlass = function() {};

SharedRedisCacheProviderKlass.prototype = {
  /**
   * Get provider
   *
   * @return {object}
   */
  getInstance: function(cacheConsistentBehavior) {
    const cacheConfigStrategy = {
      OST_CACHING_ENGINE: cacheManagementConst.redis,
      OST_DEFAULT_TTL: '86400', //24 hours
      OST_REDIS_HOST: coreConstants.OST_REDIS_HOST,
      OST_REDIS_PORT: coreConstants.OST_REDIS_PORT,
      OST_REDIS_PASS: coreConstants.OST_REDIS_PASS,
      OST_REDIS_TLS_ENABLED: coreConstants.OST_REDIS_TLS_ENABLED,
      OST_CACHE_CONSISTENT_BEHAVIOR: cacheConsistentBehavior
    };
    //TODO: Maybe add extra env var for default TTL.

    return OpenStCache.getInstance(cacheConfigStrategy);
  }
};

module.exports = new SharedRedisCacheProviderKlass();
