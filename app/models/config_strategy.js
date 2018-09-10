'use strict';

/**
 * Model to get config strategies details.
 *
 * @module app/models/config_strategy
 */

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  InMemoryCacheProvider = require(rootPrefix + '/lib/providers/in_memory_cache'),
  localCipher = require(rootPrefix + '/lib/encryptors/local_cipher'),
  ManagedAddressSaltModel = require(rootPrefix + '/app/models/managed_address_salt'),
  kmsWrapperKlass = require(rootPrefix + '/lib/authentication/kms_wrapper'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const dbName = 'saas_config_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT;

/**
 * constructor
 * @constructor
 */
const ConfigStrategyModel = function() {
  const oThis = this;

  ModelBaseKlass.call(oThis, { dbName: dbName });
};

ConfigStrategyModel.prototype = Object.create(ModelBaseKlass.prototype);

const kinds = configStrategyConstants.kinds,
  invertedKinds = configStrategyConstants.invertedKinds;

const ConfigStrategyModelSpecificPrototype = {
  tableName: 'config_strategies',

  /*
  * inserts the config strategy params, kind, managed address salt and sha encryption of config strategy params.
  *
  * @param kind(eg. dynamo,dax etc)
  * @param managedAddressSaltId
  * @param configStrategyParams: It contains complete configuration of any particular kind
  * @return {Promise<integer>} - returns a Promise with integer of strategy id.
  *
  */
  create: async function(kind, managedAddressSaltId, configStrategyParams, groupId) {
    const oThis = this,
      strategyKindInt = invertedKinds[kind],
      configStrategyParamsString = JSON.stringify(configStrategyParams);

    if (strategyKindInt === undefined) {
      throw 'Error: Improper kind parameter';
    }

    if (groupId === undefined) {
      groupId = null;
    }

    if (!configStrategyParams) {
      throw 'Config Strategy params hash cannot be null';
    }

    let isParamPresent = null,
      hashedConfigStrategyParams = localCipher.getShaHashedText(configStrategyParamsString);

    await new ConfigStrategyModel()
      .getByParams(hashedConfigStrategyParams)
      .then(function(result) {
        isParamPresent = result;
      })
      .catch(function(err) {
        logger.error('Error', err);
      });

    if (isParamPresent !== null) {
      //If configStrategyParams is already present in database then id of that param is sent
      logger.info('The given params is already present in database with id:', isParamPresent);
      return Promise.resolve(isParamPresent);
    } else {
      let response = await oThis.getDecryptedSalt(managedAddressSaltId);
      if (response.isFailure()) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'm_tb_dshh_y_1',
            api_error_identifier: 'something_went_wrong',
            debug_options: {},
            error_config: errorConfig
          })
        );
      }

      let encryptedConfigStrategyParams = localCipher.encrypt(response.data.addressSalt, configStrategyParamsString);

      const data = {
        group_id: groupId,
        kind: strategyKindInt,
        params: encryptedConfigStrategyParams,
        managed_address_salts_id: managedAddressSaltId,
        hashed_params: hashedConfigStrategyParams
      };

      const dbId = await oThis.insert(data).fire();

      return Promise.resolve(dbId.insertId);
    }
  },

  /*
  * get complete ConfigStrategy hash by passing array of strategy ids.
  *
  * @param ids: strategy ids
  * @return {Promise<Hash>} - returns a Promise with a flat hash of config strategy.
  *
  */
  getByIds: async function(ids) {
    const oThis = this;

    if (ids.length === 0) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'm_tb_dsfhh_y_1',
          api_error_identifier: 'empty_strategy_array',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    const queryResult = await oThis
      .select(['id', 'params', 'kind', 'managed_address_salts_id'])
      .where(['id IN (?)', ids])
      .fire();

    let decryptedSalts = {},
      finalResult = {};

    for (let i = 0; i < queryResult.length; i++) {
      //Following logic is added so that decrypt call is not given for already decrypted salts.
      if (decryptedSalts[queryResult[i].managed_address_salts_id] == null) {
        let response = await oThis.getDecryptedSalt(queryResult[i].managed_address_salts_id);
        if (response.isFailure()) {
          return Promise.reject(
            responseHelper.error({
              internal_error_identifier: 'm_tb_swry_1',
              api_error_identifier: 'something_went_wrong',
              debug_options: {},
              error_config: errorConfig
            })
          );
        }

        decryptedSalts[queryResult[i].managed_address_salts_id] = response.data.addressSalt;
      }

      let localDecryptedParams = localCipher.decrypt(
        decryptedSalts[queryResult[i].managed_address_salts_id],
        queryResult[i].params
      );

      const localJsonObj = JSON.parse(localDecryptedParams, oThis._dataReviver);

      let Result = {},
        strategyKind = kinds[queryResult[i].kind];

      Result[strategyKind] = localJsonObj;
      finalResult[queryResult[i].id] = Result;
    }

    return Promise.resolve(finalResult);
  },

  /**
   * @private
   *
   * This function is used by JSON.parse to check the key and value before returning.
   *
   */
  _dataReviver: function(key, value) {
    if (
      key == 'OST_UTILITY_PRICE_ORACLES' ||
      key == 'OST_UTILITY_GETH_RPC_PROVIDERS' ||
      key == 'OST_UTILITY_GETH_WS_PROVIDERS' ||
      key == 'OST_VALUE_GETH_RPC_PROVIDERS' ||
      key == 'OST_VALUE_GETH_WS_PROVIDERS'
    ) {
      return JSON.parse(value);
    }
    return value;
  },

  /*
   *
   * @param {string}:
   */
  getStrategyIdsByKindAndGroupId: async function(kind, group_id) {
    const oThis = this,
      strategyKindInt = invertedKinds[kind],
      groupId = group_id;

    if (strategyKindInt == undefined) {
      throw 'Error: Improper kind parameter';
    }

    let groupIdClause = null;

    if (group_id) {
      groupIdClause = ' (group_id = ' + groupId + ' OR group_id IS NULL)';
    }

    let query = oThis.select(['id', 'group_id']).where('kind = ' + strategyKindInt);

    if (groupIdClause) {
      query.where(groupIdClause);
    }

    logger.info('====query', query);

    let queryResult = await query.fire();

    return Promise.resolve(responseHelper.successWithData(queryResult));
  },

  /*
   *
   * This function returns distinct group ids:
   *
   * @return [Array]
   */
  getDistinctGroupIds: async function() {
    const oThis = this;

    let distinctGroupIdArray = [];

    let query = oThis.select('group_id').group_by('group_id'),
      queryResult = await query.fire();

    for (let i = 0; i < queryResult.length; i++) {
      distinctGroupIdArray.push(queryResult[i].group_id);
    }

    return Promise.resolve(responseHelper.successWithData(distinctGroupIdArray));
  },

  /**
   * This function returns group ids of the strategy ids passed as an array
   * @param strategyIdsArray
   * @returns {Promise<*>}
   */
  getGroupIdsByStrategyIds: async function(strategyIdsArray) {
    const oThis = this;

    if (strategyIdsArray.length === 0) {
      logger.error('Empty strategy Ids array was passed');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_2',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    const queryResult = await oThis
      .select(['id', 'group_id'])
      .where(['id IN (?)', strategyIdsArray])
      .fire();

    return Promise.resolve(responseHelper.successWithData(queryResult));
  },

  /*
  * Get strategy id by passing SHA encryption of params hash.<br><br>
  *
  * @param {Object} params - hashed_params - SHA of config strategy params.
  * @return {Promise<value>} - returns a Promise with a value of strategy id if it already exists.
  *
  */
  getByParams: async function(shaParams) {
    const oThis = this;

    let returnValue = null;

    let query = oThis.select('id').where({ hashed_params: shaParams }),
      queryResult = await query.fire();

    if (queryResult.length !== 0) {
      returnValue = queryResult[0].id;
    }

    return Promise.resolve(returnValue);
  },

  /**
   * Get Decrypted Config Strategy Salt from Cache or fetch.<br><br>
   *
   * @return {Promise<Result>} - returns a Promise with a decrypted salt.
   *
   */
  getDecryptedSalt: async function(managedAddressSaltId) {
    const oThis = this,
      cacheKey = coreConstants.CONFIG_STRATEGY_SALT + '_' + managedAddressSaltId;

    let consistentBehavior = '0';
    const cacheObject = InMemoryCacheProvider.getInstance(consistentBehavior);
    const cacheImplementer = cacheObject.cacheInstance;

    let configSaltResp = await cacheImplementer.get(cacheKey),
      configSalt = configSaltResp.data.response;

    if (!configSalt) {
      const addrSaltResp = await oThis._fetchAddressSalt(managedAddressSaltId);
      configSalt = addrSaltResp.data.addressSalt;
      await cacheImplementer.set(cacheKey, configSalt);
    }

    return Promise.resolve(responseHelper.successWithData({ addressSalt: configSalt }));
  },

  /**
   * @private
   *
   * @param managedAddressSaltId
   *
   */

  _fetchAddressSalt: async function(managedAddressSaltId) {
    const oThis = this;

    let addrSalt = await new ManagedAddressSaltModel().getById(managedAddressSaltId);

    if (!addrSalt[0]) {
      return responseHelper.error({
        internal_error_identifier: 'cm_mas_1',
        api_error_identifier: 'invalid_params',
        error_config: errorConfig
      });
    }

    let KMSObject = new kmsWrapperKlass('managedAddresses');
    let decryptedSalt = await KMSObject.decrypt(addrSalt[0]['managed_address_salt']);
    if (!decryptedSalt['Plaintext']) {
      return responseHelper.error({
        internal_error_identifier: 'cm_mas_2',
        api_error_identifier: 'invalid_params',
        error_config: errorConfig
      });
    }

    let salt = decryptedSalt['Plaintext'];

    return Promise.resolve(responseHelper.successWithData({ addressSalt: salt }));
  },

  /**
   * Update a strategy id.
   *
   * @param strategy_id
   * @param updatedConfigStrategyParams
   * @returns {Promise<*>}
   */
  updateStrategyId: async function(strategy_id, updatedConfigStrategyParams) {
    const oThis = this,
      queryResult = await new ConfigStrategyModel()
        .select(['managed_address_salts_id'])
        .where({ id: strategy_id })
        .fire();

    if (queryResult.length === 0) {
      logger.error('Strategy id is invalid');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'm_tb_cs_4',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    const managedAddressSaltId = queryResult[0].managed_address_salts_id,
      updatedConfigStrategyParamsString = JSON.stringify(updatedConfigStrategyParams);

    let isParamPresent = null,
      hashedUpdatedConfigStrategyParams = localCipher.getShaHashedText(updatedConfigStrategyParamsString);

    //To check if the updated config strategy is already present in the database table.
    await new ConfigStrategyModel()
      .getByParams(hashedUpdatedConfigStrategyParams)
      .then(function(result) {
        isParamPresent = result;
      })
      .catch(function(err) {
        logger.error('Error', err);
      });

    if (isParamPresent !== null && isParamPresent != strategy_id) {
      //If configStrategyParams is already present in database then id of that param is sent
      logger.error(
        'There is a config strategy already present with these params. Id present:',
        id,
        'Id getting updated:',
        strategy_id
      );
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'm_tb_cs_3',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    let response = await oThis.getDecryptedSalt(managedAddressSaltId);
    if (response.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'm_tb_cs_2',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    let encryptedUpdatedConfigStrategyParams = await localCipher.encrypt(
      response.data.addressSalt,
      updatedConfigStrategyParamsString
    );

    const data = {
      params: encryptedUpdatedConfigStrategyParams,
      hashed_params: hashedUpdatedConfigStrategyParams
    };

    const dbId = await new ConfigStrategyModel()
      .update(data)
      .where({ id: strategy_id })
      .fire();

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

Object.assign(ConfigStrategyModel.prototype, ConfigStrategyModelSpecificPrototype);

module.exports = ConfigStrategyModel;
