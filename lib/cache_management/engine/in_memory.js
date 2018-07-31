'use strict';

const openStCache = require('@openstfoundation/openst-cache');

module.exports = openStCache.getInstance({
  OST_CACHING_ENGINE: 'none',
  OST_CACHE_CONSISTENT_BEHAVIOR: 1
}).cacheInstance;
