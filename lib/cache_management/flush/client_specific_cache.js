'use strict';

/*
 *
 * Utility to flush client specific redis/memcached
 *
 * node ./lib/cache_management/flush/client_specific_cache.js <clientId> <'redis'/ 'memcached'>
 *
 */

const rootPrefix = '../../..',
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy'),
  configStrategyHelper = new ConfigStrategyHelperKlass(),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/client_specific_cache_factory');

let clientId = process.argv[2],
  cacheType = process.argv[3];

const configStrategy = configStrategyHelper.getConfigStrategy(clientId),
  instanceComposer = new InstanceComposer(configStrategy),
  cache = instanceComposer.getClientSpecificCacheProvider();

let cacheImplementer = cache.getInstance(cacheType, '1').cacheInstance;

cacheImplementer.delAll().then(function(r) {
  console.log('====Flushed', cacheType, 'for', clientId, '====');
  process.exit(0);
});
