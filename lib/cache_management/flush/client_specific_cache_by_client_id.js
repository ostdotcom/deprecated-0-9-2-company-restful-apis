'use strict';

/*
 *
 * Utility to flush client specific redis/memcached
 *
 * node ./lib/cache_management/flush/client_specific_cache_by_client_id.js <clientId> <'redis'/ 'memcached'>
 *
 */

const rootPrefix = '../../..',
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy'),
  configStrategyHelper = new ConfigStrategyHelperKlass(),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/client_specific_cache_factory');

let clientId = process.argv[2],
  cacheType = process.argv[3];

const CacheFlush = function() {};

CacheFlush.prototype = {
  perform: async function() {
    let response = await configStrategyHelper.getConfigStrategy(clientId);

    let configStrategy = response.data;

    let instanceComposer = new InstanceComposer(configStrategy),
      cache = instanceComposer.getClientSpecificCacheProvider(),
      cacheImplementer = cache.getInstance(cacheType, '1').cacheInstance;

    await cacheImplementer.delAll();
  }
};

let cacheflush = new CacheFlush();

cacheflush.perform().then(function(r) {
  console.log('====Flushed', cacheType, 'for', clientId, '====');
  process.exit(0);
});
