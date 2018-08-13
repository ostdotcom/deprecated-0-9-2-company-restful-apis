'use strict';

//Assuming for every strategy kind there exists at least one row in config_strategies table.

const rootPrefix = '../..',
  ClientConfigStrategiesModel = require(rootPrefix + '/app/models/client_config_strategies'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  clientConfigStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_management/client_config_strategies'),
  configStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_multi_management/config_strategy'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

const AssignStrategies = function(client_id, kind_strategyId_map) {
  const oThis = this;

  oThis.clientId = client_id;
  oThis.kind_strategyId_map = kind_strategyId_map || {};
};

AssignStrategies.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'l_obg_as_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   *
   * @return {Promise}
   *
   */
  asyncPerform: async function() {
    const oThis = this,
      dbFields = ['client_id', 'config_strategy_id'],
      strategyKinds = Object.keys(configStrategyConstants.invertedKinds);

    await oThis.validateSpecificStrategyValues();

    //Logic to fetch existing config strategy: Start
    let clientConfigStrategyCacheObj = new clientConfigStrategyCacheKlass({ clientId: oThis.clientId }),
      strategyIdsFetchRsp = await clientConfigStrategyCacheObj.fetch();

    if (strategyIdsFetchRsp.isFailure()) {
      return Promise.reject(strategyIdsFetchRsp);
    }

    let configStrategyData = [];
    if (strategyIdsFetchRsp.data.length > 0) {
      let strategyIdsArray = strategyIdsFetchRsp.data,
        configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: strategyIdsArray }),
        configStrategyFetchRsp = await configStrategyCacheObj.fetch();

      configStrategyData = configStrategyFetchRsp.data;
      if (configStrategyFetchRsp.isFailure()) {
        return Promise.reject(configStrategyFetchRsp);
      }
    }

    //Logic to fetch existing config strategy: End

    let configStrategyIdToDetailMap = configStrategyData,
      existingStrategyKinds = [],
      tempStrategyKindArray = strategyKinds;

    for (let configStrategyId in configStrategyIdToDetailMap) {
      let configStrategyKind = Object.keys(configStrategyIdToDetailMap[configStrategyId])[0];
      existingStrategyKinds.push(configStrategyKind);

      let index = tempStrategyKindArray.indexOf(configStrategyKind);
      tempStrategyKindArray.splice(index, 1);
    }

    let missingStrategyKinds = tempStrategyKindArray;

    if (missingStrategyKinds.length == 0) {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    let dataToEnterInDB = await oThis
      .validateAndSetCustomStrategyValuesToInsert(existingStrategyKinds, missingStrategyKinds)
      .catch(function(reason) {
        return Promise.reject(reason);
      });

    if (missingStrategyKinds.length == 0) {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    for (let i = 0; i < missingStrategyKinds.length; i++) {
      let localKind = missingStrategyKinds[i],
        strategyIdForKind = await oThis.getStrategyIdForKind(missingStrategyKinds[i]),
        values = [oThis.clientId, strategyIdForKind];

      dataToEnterInDB.push(values);
    }

    logger.debug('DataToEnterInClient_Config', dataToEnterInDB);

    let insertResp = await new ClientConfigStrategiesModel().insertMultiple(dbFields, dataToEnterInDB).fire();
    clientConfigStrategyCacheObj.clear();
  },

  /**
   *
   *
   * validates if the specific strategy id which the caller is trying to enter is valid or not.
   *
   */
  validateSpecificStrategyValues: async function() {
    const oThis = this,
      kind_strategyId_map = oThis.kind_strategyId_map;

    let configStrategyIds = Object.values(kind_strategyId_map);

    if (configStrategyIds.length === 0) {
      return;
    }

    let configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: configStrategyIds }),
      configStrategyFetchRsp = await configStrategyCacheObj.fetch(),
      configStrategyIdsToDetailMap = configStrategyFetchRsp.data;

    if (Object.keys(configStrategyFetchRsp.data).length == 0) {
      logger.error('Provided strategy ids are not present in DB');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_obg_as_5',
          api_error_identifier: 'something_went_wrong',
          error_config: errorConfig
        })
      );
    }

    for (var kind in kind_strategyId_map) {
      let strategyId = kind_strategyId_map[kind];

      if (kind != Object.keys(configStrategyIdsToDetailMap[strategyId])[0]) {
        logger.error('Provided strategy ids does not match to the strategy kinds');
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'l_obg_as_6',
            api_error_identifier: 'something_went_wrong',
            error_config: errorConfig
          })
        );
      }
    }
  },

  /**
   * @param {Array}:existingStrategyKinds
   * @param {Array}:missingStrategyKinds
   *
   * @return {Array}: values to insert in client_config_strategy_table
   *
   */
  validateAndSetCustomStrategyValuesToInsert: async function(existingStrategyKinds, missingStrategyKinds) {
    const oThis = this,
      kind_strategyId_map = oThis.kind_strategyId_map;

    let strategyKindsToBeSetSpecifically = Object.keys(oThis.kind_strategyId_map),
      dataValuesToInsert = [];
    for (let strategyKind in existingStrategyKinds) {
      let index = strategyKindsToBeSetSpecifically.indexOf(existingStrategyKinds[strategyKind]);
      if (index > -1) {
        logger.error('Error: Attempt to associate existing strategy kind.');

        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'l_obg_as_4',
            api_error_identifier: 'something_went_wrong',
            error_config: errorConfig
          })
        );
      }
    }

    for (let strategyKind in strategyKindsToBeSetSpecifically) {
      let strategyKindValue = strategyKindsToBeSetSpecifically[strategyKind],
        index = missingStrategyKinds.indexOf(strategyKindValue),
        dataRow = [oThis.clientId, kind_strategyId_map[strategyKindValue]];

      missingStrategyKinds.splice(index, 1);
      dataValuesToInsert.push(dataRow);
    }

    return dataValuesToInsert;
  },

  /**
   *
   * This function returns one of the strategy ids for the strategy kind passed as argument.
   * @param {number}: kind for which some strategy id is needed.
   * @return {number}: strategy id for the kind
   */
  getStrategyIdForKind: async function(kind) {
    const oThis = this;

    let strategyIdsForSpecificKind = await new ConfigStrategyModel().getStrategyIdsByKind(kind),
      index = oThis.clientId % strategyIdsForSpecificKind.data.length,
      specificStrategyId = strategyIdsForSpecificKind.data[index];

    return specificStrategyId;
  }
};

module.exports = AssignStrategies;
