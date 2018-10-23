'use strict';

/*
 *
 * Utility to flush client specific redis/memcached
 *
 * node ./lib/cache_management/flush/client_specific_cache_by_config.js group_id <'redis'/ 'memcached'>
 *
 *
 */

const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id');

require(rootPrefix + '/lib/providers/client_specific_cache_factory');

let group_id = JSON.parse(process.argv[2]),
  cacheType = process.argv[3];

const CacheFlush = function() {};

CacheFlush.prototype = {
  perform: async function() {
    let strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(),
      configStrategy = configStrategyResp.data;

    let instanceComposer = new InstanceComposer(configStrategy),
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
