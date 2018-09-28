'use strict';

var Flush_Cache = async function() {
  const rootPrefix = '..',
    ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
    ConfigStrategyByGroupId = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
    shell = require(rootPrefix + '/node_modules/shelljs');
  //Get the distinct chain nos or group ids from the config strategy table

  var distinctGroupIdsResponse = await new ConfigStrategyModel().getDistinctActiveGroupIds();
  var distinctGroupIdsArray = distinctGroupIdsResponse.data;
  var indexOfNull = distinctGroupIdsArray.indexOf(null);

  distinctGroupIdsArray.splice(indexOfNull, 1);

  // Flush memcache one by one for all the chains

  for (var counter = 0; counter < distinctGroupIdsArray.length; counter++) {
    var ConfigStrategyObj = new ConfigStrategyByGroupId(distinctGroupIdsArray[counter]);
    var ConfigStrategyResp = await ConfigStrategyObj.getForKind('memcached');
    var ConfigStrategyarray = ConfigStrategyResp.data;
    let configStrategyValues = Object.values(ConfigStrategyarray);
    if (
      shell.exec(
        "node ./lib/cache_management/flush/client_specific_cache_by_config.js '" +
          JSON.stringify(configStrategyValues[0]) +
          "' memcached"
      ).code !== 0
    ) {
      console.log('memcache flush failed');
      process.exit(1);
    }
  }

  //Flush shared memcache

  if (shell.exec('node ./lib/cache_management/flush/shared_memcached.js').code !== 0) {
    console.log('shared memcache flush failed');
    process.exit(1);
  }
};

Flush_Cache()
  .then(function() {
    process.exit(0);
  })
  .catch(function(err) {
    console.log(err);
    process.exit(1);
  });
