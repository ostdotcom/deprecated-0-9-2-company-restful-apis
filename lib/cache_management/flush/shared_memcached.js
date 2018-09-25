'use strict';

/*
 *
 * Utility to flush shared memcached
 *
 * node ./lib/cache_management/flush/shared_memcached.js
 *
 */

const rootPrefix = '../../..',
  cache = require(rootPrefix + '/lib/providers/shared_memcached');

let cacheImplementer = cache.getInstance().cacheInstance;

cacheImplementer.delAll().then(function(r) {
  console.log('====Flushed memcached====');
  process.exit(0);
});
