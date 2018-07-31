'use strict';

/**
 * Model to get config strategies details.
 *
 * @module app/models/config_strategy
 */

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  configStartegyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  util = require(rootPrefix + '/lib/util'),
  localCipher = require(rootPrefix + '/lib/encryptors/local_cipher'),
  addressSaltCacheKlass = require(rootPrefix + '/lib/cache_management/managedAddressesSalt'),
  inMemoryCacheInstance = require(rootPrefix + '/lib/cache_management/engine/in_memory');

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

const kinds = {
    '1': configStartegyConstants.dynamo,
    '2': configStartegyConstants.dax,
    '3': configStartegyConstants.redis,
    '4': configStartegyConstants.memcached,
    '5': configStartegyConstants.value_geth,
    '6': configStartegyConstants.value_constants,
    '7': configStartegyConstants.utility_geth,
    '8': configStartegyConstants.utility_constants,
    '9': configStartegyConstants.autoscaling,
    '10': configStartegyConstants.es,
    '11': configStartegyConstants.constants
  },
  invertedKinds = util.invert(kinds);

const ConfigStrategyModelSpecificPrototype = {
  tableName: 'config_strategies',

  insertStrategyKind: async function(params) {
    const oThis = this,
      configStrategyModelInstance = new ConfigStrategyModel(),
      kind = params.kind,
      configStrategyParams = params.config_strategy_params,
      managedAddressSaltId = params.managed_address_salt_id,
      strategyKind = invertedKinds[kind];

    let isParamPresent = [];

    let hashedConfigStrategyParams = localCipher.getShaHashedText(JSON.stringify(configStrategyParams));

    await oThis
      .getStrategyIdByParams(configStrategyParams)
      .then(function(resultArray) {
        isParamPresent = resultArray;
      })
      .catch(function(err) {
        console.log('Error', err);
      });

    if (isParamPresent.length > 0) {
      //If configStrategyParams is already present in database then id of that param is sent as the first and only element in the array.
      return Promise.resolve(isParamPresent[0]);
    } else {
      let encryptedConfigStrategyParams = '123456sdfefhdfaygefwadn';

      const data = {
        kind: strategyKind,
        params: JSON.stringify(params),
        managed_address_salts_id: 6006,
        hashed_params: hashed_params
      };

      const dbId = await configStrategyModelInstance.insert(data).fire();

      return Promise.resolve(dbId.insertId);
    }
  },

  /*

  *
  * strategyIds : array of all strategy ids whose parameters are required.
  *
  * returns: hash of all the parameters retrieved from database.
  * */
  getConfigByIds: async function(strategyIds) {
    const oThis = this;

    if (strategyIds.length == 0) {
      return Promise.reject('strategy ID array is empty');
    } else {
      var queryResult = await oThis
        .select('params')
        .where(['id IN (?)', strategyIds])
        .fire();

      console.log('QueryResults:', queryResult);

      for (var i = 0; i < queryResult.length; i++) {
        console.log('QueryResult:', queryResult[i].params);
      }

      return Promise.resolve();
    }
  },

  getStrategyIdByParams: async function(params) {
    const oThis = this;

    var returnValue = [];

    var paramsHash = localCipher.getShaHashedText(JSON.stringify(params));

    let query = oThis.select('id').where({ hashed_params: paramsHash });

    let queryResult = await query.fire();

    if (queryResult.length != 0) {
      returnValue.push(queryResult[0].id);
    }

    return Promise.resolve(returnValue);
  },

  /**
   * Get Decrypted Config Strategy Salt from Cache or fetch.<br><br>
   *
   * @return {Promise<String>} - returns a Promise with a decrypted salt.
   *
   */
  getDecreptedSalt: async function(managedAddressSaltId) {
    const oThis = this,
      cacheKey = coreConstants.CONFIG_STRATEGY_SALT + '_' + managedAddressSaltId;

    let configSaltResp = await inMemoryCacheInstance.get(cacheKey),
      configSalt = configSaltResp.data.response;

    if (!configSalt) {
      const addrSaltResp = await oThis._fetchAddressSalt(managedAddressSaltId);
      configSalt = addrSaltResp.addressSalt;
      await inMemoryCacheInstance.set(cacheKey, configSalt);
    }

    return Promise.resolve(configSalt);
  },

  /**
   * Fetch Decrypted Config Strategy Salt<br><br>
   *
   * @return {Promise<Object>} - returns a Promise with a decrypted salt.
   *
   */
  _fetchAddressSalt: async function(managedAddressSaltId) {
    const oThis = this;

    var obj = new addressSaltCacheKlass({ id: managedAddressSaltId });
    var cachedResp = await obj.fetch();
    if (cachedResp.isFailure()) {
      return Promise.resolve(cachedResp);
    }

    var salt = localCipher.decrypt(coreConstants.CACHE_SHA_KEY, cachedResp.data.addressSalt);
    return Promise.resolve({ addressSalt: salt });
  }
};

Object.assign(ConfigStrategyModel.prototype, ConfigStrategyModelSpecificPrototype);
module.exports = ConfigStrategyModel;
