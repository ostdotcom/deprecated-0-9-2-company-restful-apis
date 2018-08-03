'use strict';

const rootPrefix = '..';
const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
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
   */
  getConfigStrategy: async function(clientId) {
    const clientConfigStrategyCacheObj = new clientConfigStrategyCacheKlass({ clientId: clientId }),
      strategyIds = await clientConfigStrategyCacheObj.fetch(),
      strategyIdsArray = strategyIds.data;

    const configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: strategyIdsArray });

    let configStrategyHash = await configStrategyCacheObj.fetch();

    let configStrategyFlatHash = {};
    let FinalConfigStrategyFlatHash = {};

    let valueArray = Object.values(configStrategyHash.data);

    for (let i = 0; i < valueArray.length; i++) {
      Object.assign(configStrategyFlatHash, valueArray[i]);
    }

    valueArray = Object.values(configStrategyFlatHash);

    for (let j = 0; j < valueArray.length; j++) {
      Object.assign(FinalConfigStrategyFlatHash, valueArray[j]);
    }

    return FinalConfigStrategyFlatHash;
  }
};

module.exports = ConfigStrategyKlass;
