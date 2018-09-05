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
  oThis.groupId = null;
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
      dbFields = ['client_id', 'config_strategy_id', 'auxilary_data'],
      strategyKinds = Object.keys(configStrategyConstants.invertedKinds);

    await oThis.validateSpecificStrategyValues();

    //Logic to fetch existing config strategy: Start
    let clientConfigStrategyCacheObj = new clientConfigStrategyCacheKlass({ clientId: oThis.clientId }),
      strategyIdsFetchRsp = await clientConfigStrategyCacheObj.fetch();

    if (strategyIdsFetchRsp.isFailure()) {
      return Promise.reject(strategyIdsFetchRsp);
    }

    let configStrategyData = [],
      existingStrategyIdsArray = [];
    if (strategyIdsFetchRsp.data.length > 0) {
      existingStrategyIdsArray = strategyIdsFetchRsp.data;

      let configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: existingStrategyIdsArray }),
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

    if (missingStrategyKinds.length === 0) {
      logger.info('Strategy Ids already exists for client id: ', oThis.clientId);
      return Promise.resolve(responseHelper.successWithData({}));
    }

    let dataToEnterInDB = await oThis
      .validateAndSetCustomStrategyValuesToInsert(existingStrategyKinds, missingStrategyKinds)
      .catch(function(reason) {
        return Promise.reject(reason);
      });

    if (missingStrategyKinds.length === 0) {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    await oThis.setGroupIdForClient(existingStrategyIdsArray);

    for (let i = 0; i < missingStrategyKinds.length; i++) {
      let localStrategyKind = missingStrategyKinds[i],
        strategyIdForKind = await oThis.getStrategyIdForKind(missingStrategyKinds[i]),
        values = null;

      if (missingStrategyKinds[i] === 'dynamo') {
        let strategyHashForDynamo = await new ConfigStrategyModel().getByIds([strategyIdForKind]),
          tokenBalanceShardNamesArray =
            strategyHashForDynamo[strategyIdForKind][localStrategyKind].OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY,
          transactionLogShardNamesArray =
            strategyHashForDynamo[strategyIdForKind][localStrategyKind].OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY;

        if (tokenBalanceShardNamesArray.length === 0 || transactionLogShardNamesArray === 0) {
          logger.error(
            'Config strategy for dynamo does not have proper shard names array present in it. ' +
              'Check DynamoDb config strategy'
          );
          return Promise.reject(
            responseHelper.error({
              internal_error_identifier: 'l_obg_as_9',
              api_error_identifier: 'something_went_wrong',
              debug_options: {}
            })
          );
        }

        //Assigning shard names using round robin.
        let auxilaryDataShardName = {},
          indexOfTokenBalanceShardName = oThis.clientId % tokenBalanceShardNamesArray.length,
          indexOfTransactionLogShardName = oThis.clientId % transactionLogShardNamesArray.length;

        auxilaryDataShardName['TOKEN_BALANCE_SHARD_NAME'] = tokenBalanceShardNamesArray[indexOfTokenBalanceShardName];
        auxilaryDataShardName['TRANSACTION_LOG_SHARD_NAME'] =
          transactionLogShardNamesArray[indexOfTransactionLogShardName];

        values = [oThis.clientId, strategyIdForKind, JSON.stringify(auxilaryDataShardName)];
      } else {
        values = [oThis.clientId, strategyIdForKind, null];
      }

      dataToEnterInDB.push(values);
    }

    logger.debug('DataToEnterInClient_Config', dataToEnterInDB);

    let insertResp = await new ClientConfigStrategiesModel().insertMultiple(dbFields, dataToEnterInDB).fire();
    clientConfigStrategyCacheObj.clear();

    return Promise.resolve(responseHelper.successWithData({}));
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

    if (Object.keys(configStrategyFetchRsp.data).length === 0) {
      logger.error('Provided strategy ids are not present in DB');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_obg_as_5',
          api_error_identifier: 'something_went_wrong',
          error_config: errorConfig
        })
      );
    }

    for (let kind in kind_strategyId_map) {
      let strategyId = kind_strategyId_map[kind];

      if (kind !== Object.keys(configStrategyIdsToDetailMap[strategyId])[0]) {
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
   * @param {Array} existingStrategyKinds
   * @param {Array} missingStrategyKinds
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
   * @param existingStrategyIdsArray
   * @returns {Promise<void>}
   */
  setGroupIdForClient: async function(existingStrategyIdsArray) {
    const oThis = this;

    let extractedGroupId = null;
    if (existingStrategyIdsArray.length > 0) {
      let groupIdsOfExistingStrategiesResp = await new ConfigStrategyModel().getGroupIdsByStrategyIds(
          existingStrategyIdsArray
        ),
        groupIdsOfExistingStrategiesArray = groupIdsOfExistingStrategiesResp.data;

      //Extracting the first non null group id from the rows returned
      for (let i = 0; i < groupIdsOfExistingStrategiesArray.length; i++) {
        let currentGroupId = groupIdsOfExistingStrategiesArray[i].group_id;
        if (currentGroupId != null) {
          extractedGroupId = currentGroupId;
        }
      }
    }

    if (extractedGroupId != null) {
      oThis.groupId = extractedGroupId;
    } else {
      //Get number of groups from the table
      let distinctGroupIdsResponse = await new ConfigStrategyModel().getDistinctGroupIds(),
        distinctGroupIdsArray = distinctGroupIdsResponse.data,
        indexOfNull = distinctGroupIdsArray.indexOf(null);

      distinctGroupIdsArray.splice(indexOfNull, 1);

      let index = oThis.clientId % distinctGroupIdsArray.length;
      oThis.groupId = distinctGroupIdsArray[index];
    }
  },

  /**
   *
   * This function returns one of the strategy ids for the strategy kind passed as argument.
   * It also takes care that all the grouped strategies will be of the same group
   * @param {number}: kind for which some strategy id is needed.
   * @return {number}: strategy id for the kind
   */
  getStrategyIdForKind: async function(kind) {
    const oThis = this;

    let strategyIdsForSpecificKind = await new ConfigStrategyModel().getStrategyIdsByKindAndGroupId(
      kind,
      oThis.groupId
    );

    if (strategyIdsForSpecificKind.data.length !== 0) {
      await oThis._validateGroupIds(strategyIdsForSpecificKind.data);
      let index = oThis.clientId % strategyIdsForSpecificKind.data.length;

      return strategyIdsForSpecificKind.data[index].id;
    } else {
      logger.error('No strategy id exists for strategy kind:', kind, ' with group id ', oThis.groupId);
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_obg_as_7',
          api_error_identifier: 'something_went_wrong',
          error_config: errorConfig
        })
      );
    }
  },

  /**
   * This function checks if all the group ids are null or all the group id are integers. The array should never be a mix
   * of NULL values and integers.
   * @param strategyIdGroupIdRespArr
   * @returns {Promise<void>}
   * @private
   */
  _validateGroupIds: async function(strategyIdGroupIdRespArr) {
    let expectedGroupIdType = typeof strategyIdGroupIdRespArr[0].group_id;

    for (let i = 0; i < strategyIdGroupIdRespArr.length; i++) {
      if (typeof strategyIdGroupIdRespArr[i].group_id !== expectedGroupIdType) {
        logger.error('group ids for a particular kind cannot be a mix of null and non null values.');
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'l_obg_as_8',
            api_error_identifier: 'something_went_wrong',
            error_config: errorConfig
          })
        );
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

module.exports = AssignStrategies;
