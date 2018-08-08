'use strict';

const rootPrefix = '../..',
  ClientConfigStrategiesModel = require(rootPrefix + '/app/models/client_config_strategies'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  clientConfigStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_management/client_config_strategies'),
  configStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_multi_management/config_strategy'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

const AssignStrategies = function(client_id, kind_strategyId_map) {
  const oThis = this;

  (oThis.clientId = client_id), (oThis.kind_strategyId_map = kind_strategyId_map || {});
};

AssignStrategies.prototype = {
  /**
   *
   * @returns {Promise}
   *
   *
   */
  assignValidStrategyIds: async function() {
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

    console.log('strategy array', strategyIdsFetchRsp.data);
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
    console.log('configstrategy', configStrategyIdToDetailMap);
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

    console.log('missingStrategyKinds in func', missingStrategyKinds);
    if (missingStrategyKinds.length == 0) {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    for (let i = 0; i < missingStrategyKinds.length; i++) {
      let localKind = missingStrategyKinds[i],
        strategyIdForKind = await oThis.getStrategyIdForKind(missingStrategyKinds[i]), //Assuming we will get some existing specific value from db.
        values = [oThis.clientId, strategyIdForKind];

      dataToEnterInDB.push(values);
    }

    console.log('DataToEnter', dataToEnterInDB);

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

    let configStrategyIds = Object.values(kind_strategyId_map),
      configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: configStrategyIds }),
      configStrategyFetchRsp = await configStrategyCacheObj.fetch(),
      configStrategyIdsToDetailMap = configStrategyFetchRsp.data;

    if (Object.keys(configStrategyFetchRsp.data).length == 0) {
      throw 'Invalid strategy ids';
    }

    console.log('configStrategyIdsToDetailMap', configStrategyIdsToDetailMap);
    for (var kind in kind_strategyId_map) {
      let strategyId = kind_strategyId_map[kind];
      console.log('strategyId', strategyId);
      console.log('kind', kind);
      console.log('configStrategyIdsToDetailMap[strategyId]', configStrategyIdsToDetailMap[strategyId]);
      if (kind != Object.keys(configStrategyIdsToDetailMap[strategyId])[0]) {
        throw 'Invalid kind to strategy id mismatch';
      }
    }
  },

  /**
   * @params {Array}:existingStrategyKinds
   * @params {Array}:missingStrategyKinds
   *
   * @returns {Array}: values to insert in client_config_strategy_table
   *
   */
  validateAndSetCustomStrategyValuesToInsert: async function(existingStrategyKinds, missingStrategyKinds) {
    const oThis = this,
      kind_strategyId_map = oThis.kind_strategyId_map;

    let strategyKindsToBeSetSpecifically = Object.keys(oThis.kind_strategyId_map),
      dataValuesToInsert = [];

    console.log('existingStrategyKinds', existingStrategyKinds);
    console.log('missingStrategyKinds', missingStrategyKinds);
    console.log('strategyKindsToBeSetSpecifically', strategyKindsToBeSetSpecifically);

    for (let strategyKind in existingStrategyKinds) {
      console.log('strategyKind', existingStrategyKinds[strategyKind]);
      let index = strategyKindsToBeSetSpecifically.indexOf(existingStrategyKinds[strategyKind]);
      console.log('index', index);
      if (index > -1) {
        throw 'Error: Attempt to associate existing strategy kind.';
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
   * @params {number}: kind for which some strategy id is needed.
   * @returns {number}: strategy id for the kind
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
