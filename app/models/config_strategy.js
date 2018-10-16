'use strict';

/**
 * Model to get config strategies details.
 *
 * @module app/models/config_strategy
 */

const rootPrefix = '../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  localCipher = require(rootPrefix + '/lib/encryptors/local_cipher'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  kmsWrapperKlass = require(rootPrefix + '/lib/authentication/kms_wrapper'),
  InMemoryCacheProvider = require(rootPrefix + '/lib/providers/in_memory_cache'),
  ManagedAddressSaltModel = require(rootPrefix + '/app/models/managed_address_salt'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

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
  * @param group_id: Group Id to associate for the given params.(optional)
  * @return {Promise<integer>} - returns a Promise with integer of strategy id.
  *
  */
  create: async function(kind, managed_address_salt_id, config_strategy_params, group_id) {
    const oThis = this,
      strategyKindInt = invertedKinds[kind],
      configStrategyParams = config_strategy_params,
      managedAddressSaltId = managed_address_salt_id;

    let groupId = group_id;

    if (strategyKindInt === undefined) {
      logger.error('Improper Kind parameter');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_c_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    if (groupId === undefined) {
      groupId = null;
    }

    if (!configStrategyParams) {
      logger.error('Config Strategy params hash cannot be null');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_c_2',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    let validation = await oThis._validateSpecificParameterKeys(kind, configStrategyParams);

    if (validation.isFailure()) {
      logger.error('Specific validation failed');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_c_15',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    let strategyIdPresentInDB = null,
      hashedConfigStrategyParamsResponse = await oThis._getSHAOf(kind, configStrategyParams);
    if (hashedConfigStrategyParamsResponse.isFailure()) {
      logger.error('Error while creating SHA of params');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_c_3',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    let hashedConfigStrategyParams = hashedConfigStrategyParamsResponse.data;

    await new ConfigStrategyModel()
      .getByParams(hashedConfigStrategyParams)
      .then(function(result) {
        strategyIdPresentInDB = result;
      })
      .catch(function(err) {
        logger.error('Error', err);
      });

    if (strategyIdPresentInDB !== null) {
      //If configStrategyParamsNotToEncrypt is already present in database then id of that param is sent
      logger.info('The given params is already present in database with id:', strategyIdPresentInDB);
      return Promise.resolve(responseHelper.successWithData(strategyIdPresentInDB));
    } else {
      let separateHashesResponse = await oThis._getSeparateHashes(kind, configStrategyParams);
      if (separateHashesResponse.isFailure()) {
        logger.error('Error while segregating params into encrypted hash and unencrypted hash');
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'a_mo_cs_c_4',
            api_error_identifier: 'something_went_wrong',
            debug_options: {},
            error_config: errorConfig
          })
        );
      }

      let hashToEncrypt = separateHashesResponse.data.hashToEncrypt,
        hashNotToEncrypt = separateHashesResponse.data.hashNotToEncrypt,
        encryptedHashResponse = await oThis._getEncryption(hashToEncrypt, managedAddressSaltId);
      if (encryptedHashResponse.isFailure()) {
        logger.error('Error while encrypting data');
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'a_mo_cs_c_5',
            api_error_identifier: 'something_went_wrong',
            debug_options: {},
            error_config: errorConfig
          })
        );
      }

      let encryptedHash = encryptedHashResponse.data,
        hashNotToEncryptString = JSON.stringify(hashNotToEncrypt);

      const data = {
        group_id: groupId,
        kind: strategyKindInt,
        encrypted_params: encryptedHash,
        unencrypted_params: hashNotToEncryptString,
        managed_address_salts_id: managedAddressSaltId,
        hashed_params: hashedConfigStrategyParams
      };

      const dbId = await oThis.insert(data).fire();

      return Promise.resolve(responseHelper.successWithData(dbId.insertId));
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
      .select(['id', 'encrypted_params', 'unencrypted_params', 'kind', 'managed_address_salts_id'])
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
        queryResult[i].encrypted_params
      );

      let localJsonObj = JSON.parse(localDecryptedParams, oThis._dataReviver),
        unencryptedParamsJsonObj = JSON.parse(queryResult[i].unencrypted_params);

      Object.assign(localJsonObj, unencryptedParamsJsonObj);

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
  _getStrategyIdsByKindAndGroupId: async function(kind, group_id) {
    const oThis = this,
      strategyKindInt = invertedKinds[kind],
      groupId = group_id;

    if (strategyKindInt == undefined) {
      throw 'Error: Improper kind parameter';
    }

    let query = oThis.select(['id', 'group_id']).where('kind = ' + strategyKindInt);

    if (group_id) {
      query.where([' (group_id = ? OR group_id IS NULL)', group_id]);
    }

    let queryResult = await query.fire();

    return Promise.resolve(responseHelper.successWithData(queryResult));
  },

  /*
   *
   * This function returns distinct group ids whose status is currently 'active':
   *
   * @return [Array]
   */
  getDistinctActiveGroupIds: async function() {
    const oThis = this;

    let distinctGroupIdArray = [],
      activeStatus = configStrategyConstants.invertedStatuses[configStrategyConstants.activeStatus];

    let query = oThis
        .select('group_id')
        .where(['status = ?', activeStatus])
        .group_by('group_id'),
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
   *
   * @param {integer} strategy_id
   * @param {object} config_strategy_params
   * @returns {Promise<*>}
   */
  updateStrategyId: async function(strategy_id, config_strategy_params) {
    const oThis = this,
      strategyId = strategy_id,
      configStrategyParams = config_strategy_params,
      queryResult = await new ConfigStrategyModel()
        .select(['managed_address_salts_id', 'kind'])
        .where({ id: strategyId })
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

    let finalDataToInsertInDb = {},
      strategyKind = queryResult[0].kind,
      managedAddressSaltId = queryResult[0].managed_address_salts_id,
      strategyKindName = configStrategyConstants.kinds[strategyKind];

    let validation = await oThis._validateSpecificParameterKeys(strategyKindName, configStrategyParams);

    if (validation.isFailure()) {
      logger.error('Specific validation failed');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_c_16',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    let shaEncryptionOfStrategyParamsResponse = await oThis._getSHAOf(strategyKindName, configStrategyParams);
    if (shaEncryptionOfStrategyParamsResponse.isFailure()) {
      logger.error('Error while creating SHA of params');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_c_7',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    let shaEncryptionOfStrategyParams = shaEncryptionOfStrategyParamsResponse.data,
      strategyIdPresentInDB = null;

    //Checks if the data sent to update is already present in database at some other row.
    await new ConfigStrategyModel()
      .getByParams(shaEncryptionOfStrategyParams)
      .then(function(result) {
        strategyIdPresentInDB = result;
      })
      .catch(function(err) {
        logger.error('Error', err);
      });

    if (strategyIdPresentInDB !== null && strategyIdPresentInDB != strategyId) {
      //If configStrategyParams is already present in database then id of that param is sent
      logger.error('The config strategy is already present in database with id: ', strategyIdPresentInDB);
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'm_tb_cs_3',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    //Segregate data to encrypt and data not to encrypt
    let separateHashesResponse = await oThis._getSeparateHashes(strategyKindName, configStrategyParams);
    if (separateHashesResponse.isFailure()) {
      logger.error('Error while segregating params into encrypted hash and unencrypted hash');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_c_8',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    let hashToEncrypt = separateHashesResponse.data.hashToEncrypt,
      hashNotToEncrypt = separateHashesResponse.data.hashNotToEncrypt,
      encryptedHashResponse = await oThis._getEncryption(hashToEncrypt, managedAddressSaltId);

    if (encryptedHashResponse.isFailure()) {
      logger.error('Error while encrypting data');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_c_9',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }
    let encryptedHash = encryptedHashResponse.data;

    finalDataToInsertInDb.encrypted_params = encryptedHash;
    finalDataToInsertInDb.unencrypted_params = JSON.stringify(hashNotToEncrypt);
    finalDataToInsertInDb.hashed_params = shaEncryptionOfStrategyParams;

    const dbId = await new ConfigStrategyModel()
      .update(finalDataToInsertInDb)
      .where({ id: strategyId })
      .fire();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   *
   * @param gethProvider
   * @returns {Promise<*>}
   */
  getSiblingProvidersForNonce: async function(gethProvider) {
    const oThis = this;

    let response = {},
      unencrypted_params_hash = {},
      kindInt = null,
      gethKinds = [
        configStrategyConstants.invertedKinds[configStrategyConstants.value_geth],
        configStrategyConstants.invertedKinds[configStrategyConstants.utility_geth]
      ];

    if (!gethProvider) {
      logger.error('Mandatory parameter is missing');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_c_18',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    let chainsInfo = await oThis
      .select(['kind', 'unencrypted_params'])
      .where(['kind in (?)', gethKinds])
      .fire();

    if (chainsInfo.length === 0) {
      logger.error('Given geth provider is not present. Check the database');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_c_19',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    for (let index in chainsInfo) {
      if (chainsInfo[index].unencrypted_params.includes(gethProvider)) {
        unencrypted_params_hash = JSON.parse(chainsInfo[index].unencrypted_params);
        kindInt = chainsInfo[index].kind;
      }
    }

    if (!unencrypted_params_hash) {
      logger.error(`Given geth provider in not present in the database`);
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_c_20',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    if (configStrategyConstants.kinds[kindInt] === configStrategyConstants.utility_geth) {
      response = oThis._extractUtilityGethParams(unencrypted_params_hash, gethProvider);
    } else if (configStrategyConstants.kinds[kindInt] === configStrategyConstants.value_geth) {
      response = oThis._extractValueGethParams(unencrypted_params_hash, gethProvider);
    }

    return response;
  },

  /**
   * This function gives all the end points present in read_write key of utility geth. Provided the given geth provider
   * is present in either OST_UTILITY_GETH_WS_PROVIDERS or OST_UTILITY_GETH_RPC_PROVIDERS key of read_write object.
   * @param unencrypted_hash
   * @private
   */
  _extractUtilityGethParams: function(unencrypted_hash, gethProvider) {
    let response = {};

    response.chainId = unencrypted_hash.OST_UTILITY_CHAIN_ID;
    response.chainKind = 'utility';
    response.chainType = unencrypted_hash.OST_UTILITY_CHAIN_TYPE;

    let readWriteKeyName = 'read_write'; //Remove hard coding

    if (unencrypted_hash[readWriteKeyName].OST_UTILITY_GETH_WS_PROVIDERS.includes(gethProvider)) {
      response.siblingEndpoints = unencrypted_hash[readWriteKeyName].OST_UTILITY_GETH_WS_PROVIDERS;
    } else if (unencrypted_hash[readWriteKeyName].OST_UTILITY_GETH_RPC_PROVIDERS.includes(gethProvider)) {
      response.siblingEndpoints = unencrypted_hash[readWriteKeyName].OST_UTILITY_GETH_RPC_PROVIDERS;
    } else {
      logger.error('The given geth provider is not present in the read_write object.');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_mo_cs_c_21',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }
    response.gethWsProviders = unencrypted_hash[readWriteKeyName].OST_UTILITY_GETH_WS_PROVIDERS;
    response.gethRpcProviders = unencrypted_hash[readWriteKeyName].OST_UTILITY_GETH_RPC_PROVIDERS;
    return response;
  },

  _extractValueGethParams: function(unencrypted_hash, gethProvider) {
    let response = {};
    response.chainId = unencrypted_hash.OST_VALUE_CHAIN_ID;
    response.chainKind = 'value';
    response.chainType = configStrategyConstants.gethChainType;
    if (unencrypted_hash.OST_VALUE_GETH_WS_PROVIDERS.includes(gethProvider)) {
      response.siblingEndpoints = unencrypted_hash.OST_VALUE_GETH_WS_PROVIDERS;
    } else if (unencrypted_hash.OST_VALUE_GETH_RPC_PROVIDERS.includes(gethProvider)) {
      response.siblingEndpoints = unencrypted_hash.OST_VALUE_GETH_RPC_PROVIDERS;
    }
    response.gethWsProviders = unencrypted_hash.OST_VALUE_GETH_WS_PROVIDERS;
    response.gethRpcProviders = unencrypted_hash.OST_VALUE_GETH_RPC_PROVIDERS;

    return response;
  },

  /**
   *
   * @param (string) strategy_kind ('dynamo' or 'dax' etc)
   * @param (object) params_hash (complete hash of that strategy)
   *
   * @return {Promise<Promise<never> | Promise<any>>}
   *
   * @private
   */
  _getSHAOf: async function(strategy_kind, params_hash) {
    //Check in both param hash if the required keys are present.
    const oThis = this,
      paramsHash = params_hash,
      strategyKindName = strategy_kind,
      identifierKeysArray = configStrategyConstants.identifierKeys[strategyKindName];

    let finalHashToGetShaOf = {};

    for (let index in identifierKeysArray) {
      let keyName = identifierKeysArray[index];
      finalHashToGetShaOf[keyName] = paramsHash[keyName];
    }

    let finalHashToGetShaOfString = JSON.stringify(finalHashToGetShaOf),
      shaOfStrategyParams = localCipher.getShaHashedText(finalHashToGetShaOfString);

    return Promise.resolve(responseHelper.successWithData(shaOfStrategyParams));
  },

  /**
   *
   * @param(string) strategy_kind
   * @param(object) params_hash
   * @returns {Promise<any>}
   * @private
   */
  _getSeparateHashes: async function(strategy_kind, params_hash) {
    const oThis = this,
      strategyKindName = strategy_kind,
      configStrategyParams = params_hash;

    let kindParamsArrayToEncrypt = configStrategyConstants.keysToEncrypt[strategyKindName],
      kindParamsArrayNotToEncrypt = configStrategyConstants.keysTobeKeptUnencrypted[strategyKindName],
      hashToEncrypt = {},
      hashNotToEncrypt = {};

    for (let index in kindParamsArrayNotToEncrypt) {
      let paramsKey = kindParamsArrayNotToEncrypt[index];

      //To check if all the required keys are present in the params passed.
      if (configStrategyParams[paramsKey] === undefined) {
        logger.error(`[${paramsKey}] is not present in the hash passed for ${strategyKindName} kind`);
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'a_mo_cs_c_9',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }
      hashNotToEncrypt[paramsKey] = configStrategyParams[paramsKey];
    }

    for (let index in kindParamsArrayToEncrypt) {
      let paramsKey = kindParamsArrayToEncrypt[index];

      //To check if all the required keys are present in the params passed.
      if (configStrategyParams[paramsKey] === undefined) {
        logger.error(`[${paramsKey}] is not present in the hash passed for ${strategyKindName} kind`);
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'a_mo_cs_c_10',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }
      hashToEncrypt[paramsKey] = configStrategyParams[paramsKey];
    }

    let returnHash = {
      hashToEncrypt: hashToEncrypt,
      hashNotToEncrypt: hashNotToEncrypt
    };

    return Promise.resolve(responseHelper.successWithData(returnHash));
  },

  /**
   *
   * @param(object) params_to_encrypt
   * @param(integer) managed_address_salt_id
   * @returns {Promise<*>}
   * @private
   */
  _getEncryption: async function(params_to_encrypt, managed_address_salt_id) {
    const oThis = this,
      paramsToEncrypt = params_to_encrypt,
      managedAddressSaltId = managed_address_salt_id;

    let response = await oThis.getDecryptedSalt(managedAddressSaltId);
    if (response.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'm_tb_dshh_y_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let paramsToEncryptString = JSON.stringify(paramsToEncrypt),
      encryptedConfigStrategyParams = localCipher.encrypt(response.data.addressSalt, paramsToEncryptString);

    return Promise.resolve(responseHelper.successWithData(encryptedConfigStrategyParams));
  },

  /**
   * This function will validate only utility constants, value_geth and utility_geth
   * @param strategy_kind
   * @param params_to_validate
   * @returns {Promise<void>}
   * @private
   */
  _validateSpecificParameterKeys: async function(strategy_kind, params_to_validate) {
    const _oThis = this,
      strategyKind = strategy_kind,
      paramsToValidate = params_to_validate;

    if (strategyKind === configStrategyConstants.utility_constants) {
      const keyWhoseValueShouldBeAnObject = 'OST_UTILITY_PRICE_ORACLES';

      let value = paramsToValidate[keyWhoseValueShouldBeAnObject];
      if (value === undefined) {
        logger.error(`[${keyWhoseValueShouldBeAnObject}] is not present in the params provided`);
      }

      if (typeof value !== 'object') {
        logger.error(`[${keyWhoseValueShouldBeAnObject}] value should be an object.`);
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'm_tb_dshh_y_2',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }
    } else if (
      strategyKind === configStrategyConstants.value_geth ||
      strategyKind === configStrategyConstants.utility_geth
    ) {
      let keysWhoseValueShouldBeAnArray = null;

      if (strategyKind === configStrategyConstants.value_geth) {
        keysWhoseValueShouldBeAnArray = ['OST_VALUE_GETH_RPC_PROVIDERS', 'OST_VALUE_GETH_WS_PROVIDERS'];
        for (let index in keysWhoseValueShouldBeAnArray) {
          let keyWhoseValueToCheck = keysWhoseValueShouldBeAnArray[index],
            value = paramsToValidate[keyWhoseValueToCheck];

          if (!(value instanceof Array)) {
            logger.error(`[${keyWhoseValueToCheck}] should be an array`);
            return Promise.reject(
              responseHelper.error({
                internal_error_identifier: 'm_tb_dshh_y_3',
                api_error_identifier: 'something_went_wrong',
                debug_options: {}
              })
            );
          }
        }
      } else {
        const keyWhoseValueShouldBeAnObject = ['read_only', 'read_write'];

        for (let index in keyWhoseValueShouldBeAnObject) {
          let keyWhoseValueToCheck = keyWhoseValueShouldBeAnObject[index],
            value = paramsToValidate[keyWhoseValueToCheck];

          if (value === undefined || typeof value !== 'object') {
            logger.error(`[${keyWhoseValueShouldBeAnObject}] value should be an object.`);
            return Promise.reject(
              responseHelper.error({
                internal_error_identifier: 'm_tb_dshh_y_2',
                api_error_identifier: 'something_went_wrong',
                debug_options: {}
              })
            );
          }

          let keysWhoseValueShouldBeAnArray = ['OST_UTILITY_GETH_RPC_PROVIDERS', 'OST_UTILITY_GETH_WS_PROVIDERS'];
          for (let index in keysWhoseValueShouldBeAnArray) {
            let keyName = keysWhoseValueShouldBeAnArray[index],
              innerValueToCheck = value[keyName];

            if (!(innerValueToCheck instanceof Array)) {
              logger.error(`[${keyWhoseValueToCheck}] should be an array`);
              return Promise.reject(
                responseHelper.error({
                  internal_error_identifier: 'm_tb_dshh_y_4',
                  api_error_identifier: 'something_went_wrong',
                  debug_options: {}
                })
              );
            }
          }
        }

        let validation = await _oThis._validateUtilityProviderForUniqueness(paramsToValidate);

        if (validation.isFailure()) {
          logger.error('Specific validation failed');
          return Promise.reject(
            responseHelper.error({
              internal_error_identifier: 'm_tb_dshh_y_6',
              api_error_identifier: 'something_went_wrong',
              debug_options: {},
              error_config: errorConfig
            })
          );
        }
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  _validateUtilityProviderForUniqueness: async function(paramsToValidate) {
    let keyWhoseValueShouldBeAnObject = ['read_only', 'read_write'],
      keysWhoseValueShouldBeAnArray = ['OST_UTILITY_GETH_RPC_PROVIDERS', 'OST_UTILITY_GETH_WS_PROVIDERS'];

    for (let index in keyWhoseValueShouldBeAnObject) {
      let keyWhoseValueToCheck = keyWhoseValueShouldBeAnObject[index],
        value = paramsToValidate[keyWhoseValueToCheck];

      for (let i in keysWhoseValueShouldBeAnArray) {
        let keyName = keysWhoseValueShouldBeAnArray[i],
          providerArray = value[keyName];

        if (providerArray.length !== new Set(providerArray).size) {
          logger.error(`[${keysWhoseValueShouldBeAnArray[i]}] contains non-unique endpoints.`);
          return Promise.reject(
            responseHelper.error({
              internal_error_identifier: 'm_tb_dshh_y_5',
              api_error_identifier: 'something_went_wrong',
              debug_options: {}
            })
          );
        }
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

Object.assign(ConfigStrategyModel.prototype, ConfigStrategyModelSpecificPrototype);

module.exports = ConfigStrategyModel;
