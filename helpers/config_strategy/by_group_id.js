'use strict';

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  configStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_multi_management/config_strategy');

/**
 * groupId is optional
 * @param groupId
 * @constructor
 */
const ConfigStrategyByGroupId = function(groupId) {
  const oThis = this;

  oThis.groupId = groupId;
};

ConfigStrategyByGroupId.prototype = {
  /**
   * -This function will give a complete hash for the group id passed.
   * -If group id is not set in the constructor the this function will return an consolidated hash of all those strategy ids for which
   *  group id is not set.
   *
   *  [IMPORTANT][ASSUMPTION]: For one group id only one service will be present for a kind. This means there cannot be
   *  multiple rows of same group id and kind. (Eg. For group id 1 only one dynamo kind will be present. Similarly for others.)
   *
   * @returns {Promise<*>} Returns a flat hash of strategies
   */
  get: async function() {
    const oThis = this,
      groupId = oThis.groupId;

    let whereClause = ['group_id = ?', groupId];

    //where clause will return where group Ids are NULL
    if (groupId === undefined) {
      whereClause = ['group_id IS NULL'];
    }

    //Fetch strategy ids
    let strategyIdResponse = await new ConfigStrategyModel()
      .select(['id'])
      .where(whereClause)
      .fire();

    let strategyIdsArray = [];

    for (let index in strategyIdResponse) {
      strategyIdsArray.push(strategyIdResponse[index].id);
    }

    let configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: strategyIdsArray }),
      configStrategyFetchRsp = await configStrategyCacheObj.fetch();

    if (configStrategyFetchRsp.isFailure()) {
      logger.error('Error in fetching config strategy from cache');
      return Promise.reject(configStrategyFetchRsp);
    }

    let finalFlatHash = oThis._cacheResponseFlatHashProvider(configStrategyFetchRsp);

    return Promise.resolve(responseHelper.successWithData(finalFlatHash));
  },

  getCompleteHash: async function() {
    const oThis = this,
      groupId = oThis.groupId;

    if (groupId === undefined) {
      logger.error('Group Id is not defined. To get complete hash group id is compulsory.');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bgi_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    //Fetch strategy ids
    let strategyIdResponse = await new ConfigStrategyModel()
      .select(['id'])
      .where(['group_id = ? OR group_id IS NULL', groupId])
      .fire();

    let strategyIdsArray = [];

    for (let index in strategyIdResponse) {
      strategyIdsArray.push(strategyIdResponse[index].id);
    }

    let configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: strategyIdsArray }),
      configStrategyFetchRsp = await configStrategyCacheObj.fetch();

    if (configStrategyFetchRsp.isFailure()) {
      logger.error('Error in fetching config strategy from cache');
      return Promise.reject(configStrategyFetchRsp);
    }

    let finalFlatHash = oThis._cacheResponseFlatHashProvider(configStrategyFetchRsp);

    return Promise.resolve(responseHelper.successWithData(finalFlatHash));
  },

  // returns Hash
  // {
  //    1: {
  //        }
  // }
  getForKind: async function(kind) {
    const oThis = this,
      groupId = oThis.groupId;

    let strategyIdInt = configStrategyConstants.invertedKinds[kind],
      whereClause = ['group_id = ? AND kind = ?', groupId, strategyIdInt];

    //where clause will return where group Ids are NULL
    if (groupId === undefined) {
      whereClause = ['group_id IS NULL AND kind = ?', strategyIdInt];
    }

    if (strategyIdInt === undefined) {
      logger.error('Provided kind is not proper. Please check kind');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bgi_4',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    //Following is to fetch specific strategy id for the kind passed.
    let strategyIdResponse = await new ConfigStrategyModel()
      .select(['id'])
      .where(whereClause)
      .fire();

    if (strategyIdResponse.length === 0) {
      logger.error('Strategy Id for the provided kind not found OR kind for the given group id does not exist');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bci_2',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let strategyIdsArray = [];

    for (let index in strategyIdResponse) {
      strategyIdsArray.push(strategyIdResponse[index].id);
    }

    let configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: strategyIdsArray }),
      configStrategyFetchRsp = await configStrategyCacheObj.fetch();

    if (configStrategyFetchRsp.isFailure()) {
      logger.error('Error in fetching config strategy from cache');
      return Promise.reject(configStrategyFetchRsp);
    }

    let configStrategyIdToDetailMap = configStrategyFetchRsp.data,
      finalConfigStrategyFlatHash = {};

    for (let configStrategyId in configStrategyIdToDetailMap) {
      let configStrategy = configStrategyIdToDetailMap[configStrategyId];

      for (let strategyKind in configStrategy) {
        //Object.assign(finalConfigStrategyFlatHash, configStrategy[strategyKind]);
        finalConfigStrategyFlatHash[configStrategyId] = configStrategy[strategyKind];
      }
    }

    return Promise.resolve(responseHelper.successWithData(finalConfigStrategyFlatHash));
  },

  //clear cache after every update and create
  addForKind: function(kind, params) {
    const oThis = this,
      groupId = oThis.groupId,
      strategyIdInt = configStrategyConstants.invertedKinds[kind];

    if (strategyIdInt === undefined) {
      logger.error('Provided kind is not proper. Please check kind');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bgi_4',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }
  },

  updateForKind: function(kind, params, old_data) {},

  getAllKinds: function() {
    let kindsHash = configStrategyConstants.kinds,
      kindsArray = Object.values(kindsHash);

    return kindsArray;
  },

  /**
   * This function helps in preparing flat hash from the response given by cache
   * @param configStrategyResponse
   * @private
   */
  _cacheResponseFlatHashProvider: function(configStrategyResponse) {
    const oThis = this;

    let configStrategyIdToDetailMap = configStrategyResponse.data,
      finalConfigStrategyFlatHash = {};

    for (let configStrategyId in configStrategyIdToDetailMap) {
      let configStrategy = configStrategyIdToDetailMap[configStrategyId];

      for (let strategyKind in configStrategy) {
        Object.assign(finalConfigStrategyFlatHash, configStrategy[strategyKind]);
      }
    }

    return finalConfigStrategyFlatHash;
  }
};

module.exports = ConfigStrategyByGroupId;
