'use strict';

const rootPrefix = '..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  clientConfigStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_multi_management/client_config_strategies'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  configStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_multi_management/config_strategy');

/**
 *
 * @constructor
 */
const ConfigStrategyKlass = function() {};

ConfigStrategyKlass.prototype = {
  /**
   * Get final hash of config strategy
   * @param {number} clientId: client ID whose config strategy hash is needed.
   *
   *
   * @return {Promise<Object>} Hash of config strategy
   */
  getConfigStrategy: async function(clientId) {
    let clientConfigStrategyCacheObj = new clientConfigStrategyCacheKlass({ clientIds: [clientId] }),
      fetchCacheRsp = await clientConfigStrategyCacheObj.fetch();

    if (fetchCacheRsp.isFailure()) {
      return Promise.reject(fetchCacheRsp);
    }

    let cacheData = fetchCacheRsp.data[clientId];

    let strategyIdsArray = cacheData.configStrategyIds,
      configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: strategyIdsArray }),
      configStrategyFetchRsp = await configStrategyCacheObj.fetch(),
      dynamoDbShardNames = cacheData.shard_names;

    if (configStrategyFetchRsp.isFailure()) {
      return Promise.reject(configStrategyFetchRsp);
    }

    let finalConfigStrategyFlatHash = {},
      configStrategyIdToDetailMap = configStrategyFetchRsp.data;

    for (let configStrategyId in configStrategyIdToDetailMap) {
      let configStrategy = configStrategyIdToDetailMap[configStrategyId];

      for (let strategyKind in configStrategy) {
        Object.assign(finalConfigStrategyFlatHash, configStrategy[strategyKind]);
      }
    }

    Object.assign(finalConfigStrategyFlatHash, dynamoDbShardNames);
    return Promise.resolve(responseHelper.successWithData(finalConfigStrategyFlatHash));
  },

  getStrategyIdForKind: async function(clientId, kind) {
    let clientConfigStrategyCacheObj = new clientConfigStrategyCacheKlass({ clientIds: [clientId] }),
      strategyIdsFetchRsp = await clientConfigStrategyCacheObj.fetch(),
      strategyIdForKind = [];

    if (strategyIdsFetchRsp.isFailure()) {
      return Promise.reject(strategyIdsFetchRsp);
    }

    let strategyIdsArray = strategyIdsFetchRsp.data.configStrategyIds;

    let strategyKindtoIdMapRsp = await new ConfigStrategyModel()
      .select(['id', 'kind'])
      .where(['id in (?)', strategyIdsArray])
      .fire();

    for (let index = 0; index < strategyKindtoIdMapRsp.length; index++) {
      if (String(strategyKindtoIdMapRsp[index].kind) === configStrategyConstants.invertedKinds[kind]) {
        strategyIdForKind.push(strategyKindtoIdMapRsp[index].id);
      }
    }

    return Promise.resolve(responseHelper.successWithData(strategyIdForKind));
  }
};

module.exports = ConfigStrategyKlass;
