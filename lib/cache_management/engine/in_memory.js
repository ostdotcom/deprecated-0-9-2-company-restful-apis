'use strict';

const openStCache = require('@openstfoundation/openst-cache');

module.exports = openStCache.getInstance({ OST_CACHING_ENGINE: 'in-memory', OST_CACHE_CONSISTENT_BEHAVIOR: 1 });
