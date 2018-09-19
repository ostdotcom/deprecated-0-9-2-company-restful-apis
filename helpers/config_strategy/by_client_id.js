'use strict';

/**
 * This script provides config strategy on the basis of client id.
 * @type {string}
 */
const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  clientConfigStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_multi_management/client_config_strategies'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  configStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_multi_management/config_strategy');

const ConfigStrategyByClientId = function(clientId) {
  const oThis = this;

  oThis.clientId = clientId;
};

ConfigStrategyByClientId.prototype = {
  /**
   * Get final hash of config strategy
   * @returns {Promise<*>}
   */
  get: async function() {
    const oThis = this;

    let clientId = oThis.clientId;

    if (clientId === undefined) {
      logger.error('client Id is not defined. To get complete hash client id is compulsory.');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bci_4',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let clientConfigStrategyCacheObj = new clientConfigStrategyCacheKlass({ clientIds: [clientId] }),
      fetchCacheRsp = await clientConfigStrategyCacheObj.fetch();

    if (fetchCacheRsp.isFailure()) {
      return Promise.reject(fetchCacheRsp);
    }

    let cacheData = fetchCacheRsp.data[clientId];

    let strategyIdsArray = cacheData.configStrategyIds,
      configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: strategyIdsArray }),
      configStrategyFetchRsp = await configStrategyCacheObj.fetch(),
      finalConfigStrategyFlatHash = cacheData.shard_names; //Setting the shard names for the client in the initial array itself.

    if (configStrategyFetchRsp.isFailure()) {
      return Promise.reject(configStrategyFetchRsp);
    }

    let configStrategyIdToDetailMap = configStrategyFetchRsp.data;

    for (let configStrategyId in configStrategyIdToDetailMap) {
      let configStrategy = configStrategyIdToDetailMap[configStrategyId];

      for (let strategyKind in configStrategy) {
        Object.assign(finalConfigStrategyFlatHash, configStrategy[strategyKind]);
      }
    }

    return Promise.resolve(responseHelper.successWithData(finalConfigStrategyFlatHash));
  },

  /**
   *
   * This function will return config strategy hash for the kind passed as an argument.
   * @param(string) kind - kind should be provided as a string. (Eg. dynamo or dax etc)
   * @returns {Promise<*>}
   */
  getForKind: async function(kind) {
    const oThis = this,
      clientId = oThis.clientId;

    if (clientId === undefined) {
      logger.error('client Id is not defined. To get complete hash client id is compulsory.');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bci_3',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let clientConfigStrategyCacheObj = new clientConfigStrategyCacheKlass({ clientIds: [clientId] }),
      strategyIdsFetchRsp = await clientConfigStrategyCacheObj.fetch();

    if (strategyIdsFetchRsp.isFailure()) {
      return Promise.reject(strategyIdsFetchRsp);
    }

    let strategyIdInt = configStrategyConstants.invertedKinds[kind];

    if (strategyIdInt === undefined) {
      logger.error('Provided kind is not proper. Please check kind');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bci_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let strategyIdsArray = strategyIdsFetchRsp.data[clientId].configStrategyIds;

    //Following is to fetch specific strategy id for the kind passed.
    let specificStrategyIdArray = await new ConfigStrategyModel()
      .select(['id'])
      .where(['id in (?) AND kind = ?', strategyIdsArray, strategyIdInt])
      .fire();

    if (specificStrategyIdArray.length !== 1) {
      logger.error('Strategy Id for the provided kind not found.');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bci_2',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let strategyId = specificStrategyIdArray[0].id,
      strategyIdArray = [strategyId];

    let configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: strategyIdArray }),
      configStrategyFetchRsp = await configStrategyCacheObj.fetch();

    if (configStrategyFetchRsp.isFailure()) {
      return Promise.reject(configStrategyFetchRsp);
    }

    //prepare a hash and return
    let configStrategyIdToDetailMap = configStrategyFetchRsp.data,
      finalConfigStrategyHash = configStrategyIdToDetailMap[strategyId][kind];

    return Promise.resolve(responseHelper.successWithData(finalConfigStrategyHash));
  }
};

module.exports = ConfigStrategyByClientId;
