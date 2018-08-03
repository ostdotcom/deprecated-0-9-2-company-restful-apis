'use strict';

/**
 * Memcached cache instance provider which is not client specific.
 *
 *@module lib/providers/shared_memcached
 */

const rootPrefix = '../..',
  openStCache = require('@openstfoundation/openst-cache'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management');

module.exports = openStCache.getInstance({
  OST_CACHING_ENGINE: cacheManagementConst.memcached,
  OST_MEMCACHE_SERVERS: coreConstants.SHARED_MEMCACHE_SERVERS,
  OST_DEFAULT_TTL: '86400', //24 hours
  OST_CACHE_CONSISTENT_BEHAVIOR: '1'
});

//TODO: Maybe add extra env var for default TTL.
