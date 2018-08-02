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
  //addressSaltCacheKlass = require(rootPrefix + '/lib/cache_management/managedAddressesSalt'),
  //inMemoryCacheInstance = require(rootPrefix + '/lib/cache_management/engine/in_memory'),
  encryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor');

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

  /*
  * inserts the config strategy params, kind, managed address salt and sha encryption of config strategy params.
  *
  * @params
  * @return {Promise<integer>} - returns a Promise with integer of strategy id.
  *
  */
  create: async function(kind, managedAddressSaltId, configStrategyParams) {
    const oThis = this,
      strategyKindInt = invertedKinds[kind],
      encryptorObj = new encryptorKlass({ managedAddressSaltId: managedAddressSaltId });

    let isParamPresent = null,
      configStrategyParamsString = JSON.stringify(configStrategyParams),
      encryptedConfigStrategyParams = await encryptorObj.encrypt(configStrategyParamsString),
      hashedConfigStrategyParams = localCipher.getShaHashedText(configStrategyParamsString);

    await oThis
      .getByParams(configStrategyParams)
      .then(function(result) {
        isParamPresent = result;
      })
      .catch(function(err) {
        console.log('Error', err);
      });

    if (isParamPresent != null) {
      //If configStrategyParams is already present in database then id of that param is sent
      return Promise.resolve(isParamPresent);
    } else {
      const data = {
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
  * @return {Promise<Hash>} - returns a Promise with a flat hash of config strategy.
  *
  *
  */
  getByIds: async function(ids) {
    const oThis = this;

    if (ids.length == 0) {
      return Promise.reject('strategy ID array is empty');
    } else {
      const queryResult = await oThis
        .select(['params', 'id', 'managed_address_salts_id'])
        .where(['id IN (?)', ids])
        .fire();

      let finalResult = {};
      for (let i = 0; i < queryResult.length; i++) {
        const encryptorObj = new encryptorKlass({ managedAddressSaltId: queryResult[i].managed_address_salts_id });
        const localDecryptedParams = await encryptorObj.decrypt(queryResult[i].params);
        const localJsonObj = JSON.parse(localDecryptedParams);
        finalResult[kinds[queryResult[i].id]] = localJsonObj;
      }

      //console.log("Final--------------",finalResult);

      return Promise.resolve(finalResult);
    }
  },

  /*
  * Get strategy id by passing unencrypted params hash.<br><br>
  *
  * @return {Promise<array>} - returns a Promise with an array containing strategy id.
  *
  */
  getByParams: async function(params) {
    const oThis = this;

    var returnValue = [],
      paramsHash = localCipher.getShaHashedText(JSON.stringify(params));

    let query = oThis.select('id').where({ hashed_params: paramsHash }),
      queryResult = await query.fire();

    if (queryResult.length != 0) {
      returnValue.push(queryResult[0].id);
    }

    return Promise.resolve(returnValue[0]);
  }
};

Object.assign(ConfigStrategyModel.prototype, ConfigStrategyModelSpecificPrototype);

module.exports = ConfigStrategyModel;
