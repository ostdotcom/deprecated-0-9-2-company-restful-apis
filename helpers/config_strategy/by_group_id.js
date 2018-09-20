'use strict';

/**
 * CRUD for config_strategies table
 * @type {string}
 */
const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  ChainGethProviderModel = require(rootPrefix + '/app/models/chain_geth_providers'),
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
   * -If group id is not set in the constructor this function will return an consolidated hash of all those strategy ids for which
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

    // to not replicate the decryption logic, we are calling the cache for the same.

    let fetchConfigStrategyRsp = await oThis._getConfigStrategyByStrategyId(strategyIdsArray);

    if (fetchConfigStrategyRsp.isFailure()) {
      logger.error('Error in fetching config strategy flat hash');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bgi_18',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }
    let finalFlatHash = oThis._cacheResponseFlatHashProvider(fetchConfigStrategyRsp);

    return Promise.resolve(responseHelper.successWithData(finalFlatHash));
  },

  /**
   * This function gives a complete flat hash of all the strategies including the ones whose group id is NULL.
   *
   * [IMPORTANT][ASSUMPTION]: Multiple value_geth, constants, in_memory, value_constants kinds will not be present in the table.
   * @returns {Promise<*>}
   */
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

    let fetchConfigStrategyRsp = await oThis._getConfigStrategyByStrategyId(strategyIdsArray);

    if (fetchConfigStrategyRsp.isFailure()) {
      logger.error('Error in fetching config strategy flat hash');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bgi_19',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let finalFlatHash = oThis._cacheResponseFlatHashProvider(fetchConfigStrategyRsp);

    return Promise.resolve(responseHelper.successWithData(finalFlatHash));
  },

  /**
   * This function gives a hash for the kind provided.
   * It returns hash whose key is the strategy id and value is the flat hash of the strategy.
   * Eg:
   * {
   *    1: {
   *          OS_DYNAMODB_ACCESS_KEY_ID : 'xyz',
   *          OS_DYNAMODB_SECRET_ACCESS_KEY: 'x',
   *          .
   *          .
   *          .
   *       }
   * }
   * @param kind
   * @returns {Promise<*>}
   */
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

    let fetchConfigStrategyRsp = await oThis._getConfigStrategyByStrategyId(strategyIdsArray);

    if (fetchConfigStrategyRsp.isFailure()) {
      logger.error('Error in fetching config strategy flat hash');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bgi_20',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let configStrategyIdToDetailMap = fetchConfigStrategyRsp.data,
      finalConfigStrategyFlatHash = {};

    for (let configStrategyId in configStrategyIdToDetailMap) {
      let configStrategy = configStrategyIdToDetailMap[configStrategyId];

      for (let strategyKind in configStrategy) {
        finalConfigStrategyFlatHash[configStrategyId] = configStrategy[strategyKind];
      }
    }

    return Promise.resolve(responseHelper.successWithData(finalConfigStrategyFlatHash));
  },

  /**
   * This function adds a strategy in config_strategies table. If the kind being inserted in value_geth or utility_geth then
   * WS provider and RPC provider is also inserted in the chain_geth_providers table.
   *
   * @param {string} kind (Eg:'dynamo')
   * @param {object}params
   * @param {number}managed_address_salt_id
   * @returns {Promise<never>}
   */
  addForKind: async function(kind, params, managed_address_salt_id) {
    const oThis = this,
      groupId = oThis.groupId,
      strategyIdInt = configStrategyConstants.invertedKinds[kind];

    if (strategyIdInt === undefined) {
      logger.error('Provided kind is not proper. Please check kind');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bgi_5',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let managedAddressSaltId = managed_address_salt_id;
    if (configStrategyConstants.kindsWithoutGroupId.includes(kind)) {
      // If group id is present, reject
      if (groupId) {
        logger.error(`To insert [${kind}] group id is not required.`);
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'h_cs_bgi_15',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }

      let configStrategyModelObj = new ConfigStrategyModel(),
        insertResponse = await configStrategyModelObj.create(kind, managedAddressSaltId, params);

      if (insertResponse.isFailure()) {
        logger.error('Error in inserting data in config_strategies table ');
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'h_cs_bgi_6',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }
    } else {
      //Group id is mandatory for the kind passed as argument.
      if (groupId === undefined) {
        logger.error(`To insert [${kind}] group id is mandatory.`);
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'h_cs_bgi_7',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }

      let configStrategyModelObj = new ConfigStrategyModel(),
        insertResponse = await configStrategyModelObj.create(kind, managedAddressSaltId, params, groupId);

      if (insertResponse.isFailure()) {
        logger.error('Error while inserting data in config strategy table ');
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'h_cs_bgi_8',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }
    }

    if (kind === 'value_geth' || kind === 'utility_geth') {
      //get both the geth end point and update

      let promises = [],
        rpcProviderArray = params.OST_VALUE_GETH_RPC_PROVIDERS,
        wsProviderArray = params.OST_VALUE_GETH_WS_PROVIDERS,
        chainId = params.OST_VALUE_CHAIN_ID,
        chainKind = 'value';

      if (kind === 'utility_geth') {
        rpcProviderArray = params.OST_UTILITY_GETH_RPC_PROVIDERS;
        wsProviderArray = params.OST_UTILITY_GETH_WS_PROVIDERS;
        chainId = params.OST_UTILITY_CHAIN_ID;
        chainKind = 'utility';
      }

      //Assuming number of rpc providers and ws providers will be same
      for (let i = 0; i < rpcProviderArray.length; i++) {
        promises.push(
          await new ChainGethProviderModel().insertRecord({
            chain_id: parseInt(chainId),
            chain_kind: chainKind,
            ws_provider: wsProviderArray[i],
            rpc_provider: rpcProviderArray[i]
          })
        );
      }

      await Promise.all(promises);
    }
  },

  /**
   * This function updates the strategy id for the given kind.
   * If chain_geth_providers table is to be updated then
   * If the kind is to be updated is value_geth or utility_geth the old_data parameters
   * @param(string) kind
   * @param params
   * @param {object}old_data (old_data = {'WS_Provider': '127.0.0.1:8545','RPC_Provider':'127.0.0.1:1845' }). This the old
   * data which is to be replaced.
   * @returns {Promise<never>}
   */
  updateForKind: async function(kind, params, old_data) {
    const oThis = this,
      groupId = oThis.groupId,
      strategyIdInt = configStrategyConstants.invertedKinds[kind];

    if (strategyIdInt === undefined) {
      logger.error('Provided kind is not proper. Please check kind');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bgi_9',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let whereClause = null;
    if (configStrategyConstants.kindsWithoutGroupId.includes(kind)) {
      //Should not have group id
      if (groupId) {
        logger.error(`To insert [${kind}] group id is not required.`);
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'h_cs_bgi_16',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }

      whereClause = ['group_id IS NULL AND kind = ?', strategyIdInt];
    } else {
      //should have group id
      if (groupId === undefined) {
        logger.error(`To insert [${kind}] group id is mandatory.`);
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'h_cs_bgi_17',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }

      whereClause = ['group_id = ? AND kind = ?', groupId, strategyIdInt];
    }

    //Following is to fetch specific strategy id for the kind passed.
    //Specific strategy id is needed in order to use the function provided in model of config strategy which handles encryption
    //decryption logic.
    let strategyIdResponse = await new ConfigStrategyModel()
      .select(['id'])
      .where(whereClause)
      .fire();

    if (strategyIdResponse.length === 0) {
      logger.error('Strategy Id for the provided kind not found OR kind for the given group id does not exist');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bgi_11',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    if (strategyIdResponse.length > 1) {
      logger.error('Multiple entries(rows) found for the same group id and kind combination');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bgi_12',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let strategyId = strategyIdResponse[0].id,
      configStrategyModelObj = new ConfigStrategyModel(),
      updateResponse = await configStrategyModelObj.updateStrategyId(strategyId, params);

    if (updateResponse.isFailure()) {
      logger.error('Error while updating data in config strategy table ');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'h_cs_bgi_13',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    //clearing the cache
    let configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: [strategyId] }),
      configStrategyFetchRsp = await configStrategyCacheObj.clear();

    if (kind === 'value_geth' || kind === 'utility_geth') {
      //get both the geth end point and update

      if (!old_data) {
        logger.error('Geth providers table is not updated because old data was not passed');
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'h_cs_bgi_14',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }

      let new_ws_provider = null,
        new_rpc_provider = null;
      if (kind === 'value_geth') {
        new_ws_provider = params.OST_VALUE_GETH_WS_PROVIDER;
        new_rpc_provider = params.OST_VALUE_GETH_RPC_PROVIDER;
      } else {
        new_ws_provider = params.OST_UTILITY_GETH_WS_PROVIDER;
        new_rpc_provider = params.OST_UTILITY_GETH_RPC_PROVIDER;
      }

      if (old_data.WS_Provider) {
        //Update WS Provider
        let updateResponse = await new ChainGethProviderModel()
          .update({ ws_provider: new_ws_provider })
          .where({
            ws_provider: old_data.WS_Provider
          })
          .fire();
      }

      if (old_data.RPC_Provider) {
        //Update RPC Provider
        let updateResponse = await new ChainGethProviderModel()
          .update({ rpc_provider: new_rpc_provider })
          .where({
            rpc_provider: old_data.RPC_Provider
          })
          .fire();
      }
    }
  },

  /**
   * This function returns an array of all the strategy kinds.
   * @returns {array}
   */
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
  },

  /**
   * This function returns config strategy of the strategy ids passed as argument
   * @param {array}strategyIdsArray
   * @returns {Promise<*>}
   * @private
   */
  _getConfigStrategyByStrategyId: async function(strategyIdsArray) {
    let configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: strategyIdsArray }),
      configStrategyFetchRsp = await configStrategyCacheObj.fetch();

    if (configStrategyFetchRsp.isFailure()) {
      logger.error('Error in fetching config strategy from cache');
      return Promise.reject(configStrategyFetchRsp);
    }

    return Promise.resolve(responseHelper.successWithData(configStrategyFetchRsp.data));
  }
};

module.exports = ConfigStrategyByGroupId;
