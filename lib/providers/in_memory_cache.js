'use strict';

/**
 * In-memory cache instance provider.
 *
 *@module lib/providers/in_memory_cache
 */

const openStCache = require('@openstfoundation/openst-cache');

module.exports = openStCache.getInstance({
  OST_CACHING_ENGINE: 'none',
  OST_DEFAULT_TTL: '86400', //24 hours
  OST_CACHE_CONSISTENT_BEHAVIOR: '1'
});

//TODO: Maybe add extra env var for default TTL.
