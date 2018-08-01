'use strict';

const openStCache = require('@openstfoundation/openst-cache');

const rootPrefix = '../../..',
  coreConstants = require(rootPrefix + '/config/core_constants');

module.exports = openStCache.getInstance({
  OST_CACHING_ENGINE: coreConstants.SAAS_ONLY_CACHE_ENGINE,
  OST_MEMCACHE_SERVERS: coreConstants.MEMCACHE_SERVERS,
  OST_CACHE_CONSISTENT_BEHAVIOR: 0
});
