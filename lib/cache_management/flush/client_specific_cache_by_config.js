'use strict';

/*
 *
 * Utility to flush client specific redis/memcached
 *
 * node ./lib/cache_management/flush/client_specific_cache_by_config.js <configHash> <'redis'/ 'memcached'>
 *
 *
 */

/*
 configHash = {
  "OST_MEMCACHE_SERVERS": "127.0.0.1:11211",
  "OST_REDIS_HOST": "127.0.0.1",
  "OST_REDIS_PORT": "6379",
  "OST_REDIS_PASS": "st123",
  "OST_REDIS_TLS_ENABLED": "0",
  "OST_DEFAULT_TTL": "36000"
 }
 */

const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/client_specific_cache_factory');

let config = JSON.parse(process.argv[2]),
  cacheType = process.argv[3];

const CacheFlush = function() {};

CacheFlush.prototype = {
  perform: async function() {
    let instanceComposer = new InstanceComposer(config),
      cache = instanceComposer.getClientSpecificCacheProvider(),
      cacheImplementer = cache.getInstance(cacheType, '1').cacheInstance;

    return cacheImplementer.delAll();
  }
};

let cacheflush = new CacheFlush();

cacheflush.perform().then(function(r) {
  console.log('====Flushed', cacheType, '====');
  process.exit(0);
});
