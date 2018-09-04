'use strict';

const rootPrefix = '..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  clientConfigStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_management/client_config_strategies'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
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
    let clientConfigStrategyCacheObj = new clientConfigStrategyCacheKlass({ clientId: clientId }),
      strategyIdsFetchRsp = await clientConfigStrategyCacheObj.fetch();

    if (strategyIdsFetchRsp.isFailure()) {
      return Promise.reject(strategyIdsFetchRsp);
    }

    let strategyIdsArray = strategyIdsFetchRsp.data.configStrategyIds,
      configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: strategyIdsArray }),
      configStrategyFetchRsp = await configStrategyCacheObj.fetch(),
      dynamoDbShardNames = strategyIdsFetchRsp.data.shard_names;

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
  }
};

module.exports = ConfigStrategyKlass;
