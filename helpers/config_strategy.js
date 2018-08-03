'use strict';

const rootPrefix = '..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  clientConfigStrategyCacheKlass = require(rootPrefix + '/lib/cache_management/client_config_strategies'),
  configStrategyCacheKlass = require(rootPrefix + '/lib/cache_multi_management/config_strategy');

/**
 *
 * @constructor
 */
const ConfigStrategyKlass = function() {};

ConfigStrategyKlass.prototype = {
  /**
   * Get final hash of config strategy
   * @param clientID: client ID whose config strategy hash is needed.
   *
   *
   * @returns Hash of configstrategy
   */
  getConfigStrategy: async function(clientId) {
    let clientConfigStrategyCacheObj = new clientConfigStrategyCacheKlass({ clientId: clientId }),
      strategyIdsFetchRsp = await clientConfigStrategyCacheObj.fetch();

    if (strategyIdsFetchRsp.isFailure()) {
      return Promise.reject(strategyIdsFetchRsp);
    }

    let strategyIdsArray = strategyIdsFetchRsp.data,
      configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: strategyIdsArray }),
      configStrategyFetchRsp = await configStrategyCacheObj.fetch();

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

    return finalConfigStrategyFlatHash;
  }
};

module.exports = ConfigStrategyKlass;
