'use strict';

/**
 * Model to get config strategies details.
 *
 * @module app/models/config_strategy
 */

const sortJson = require('sort-json');

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  configStartegyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
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

const kind = {
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
};
const ConfigStrategyModelSpecificPrototype = {
  tableName: 'config_strategies',

  _sort: function(params) {
    const options = { ignoreCase: true, reverse: false, depth: 1 };
    const sorted_params = sortJson(params, options);

    return sorted_params;
  },

  insertStrategyKind: function(kind, params) {
    // insert into  config_strategies values ();
    /*
      get the plaintext
      get the local cipher of params

    */
    //returns strategy id autoincrement
  },

  getConfigById: function(clientId) {
    const oThis = this;

    return oThis.select('*')``.where({ clientId: clientId }).fire();
  },

  getStrategyIdByParams: async function(params) {
    const oThis = this;

    var sortedParams = oThis._sort(params),
      returnValue = [];

    var sortedParamsHash = localCipher.getShaHashedText(JSON.stringify(sortedParams));

    let query = oThis.select('id').where({ hashed_params: sortedParamsHash });

    let queryResult = await query.fire();

    if (queryResult.length != 0) {
      returnValue.push(queryResult[0].id);
    }

    return Promise.resolve(returnValue);
  },

  /**
   * Get Decrypted Config Strategy Salt from Cache or fetch.<br><br>
   *
   * @return {Promise<Result>} - returns a Promise with a decrypted salt.
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
   * @return {Promise<Result>} - returns a Promise with a decrypted salt.
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
