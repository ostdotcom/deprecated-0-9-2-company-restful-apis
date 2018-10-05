'use strict';

/*
 *
 * Utility to flush shared redis cache
 *
 * node ./lib/cache_management/flush/shared_redis.js
 *
 */

const rootPrefix = '../../..',
  cache = require(rootPrefix + '/lib/providers/shared_redis');

let cacheImplementer = cache.getInstance().cacheInstance;

cacheImplementer.delAll().then(function() {
  console.log('====Flushed redis====');
  process.exit(0);
});
