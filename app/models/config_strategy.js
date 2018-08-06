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
  * @return {Promise<integer>} - returns a Promise with integer of strategy id.
  *
  */
  create: async function(kind, managedAddressSaltId, configStrategyParams) {
    const oThis = this,
      strategyKindInt = invertedKinds[kind],
      configStrategyParamsString = JSON.stringify(configStrategyParams);

    if (strategyKindInt == undefined) {
      throw 'Error: Improper kind parameter';
    }

    if (!configStrategyParams) {
      throw 'Config Strategy params hash cannot be null';
    }

    let isParamPresent = null,
      hashedConfigStrategyParams = localCipher.getShaHashedText(configStrategyParamsString);

    await new ConfigStrategyModel()
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
      let response = await oThis.getDecryptedSalt(managedAddressSaltId);
      if (response.isFailure()) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'm_tb_dshh_y_1',
            api_error_identifier: 'invalid_salt',
            debug_options: {},
            error_config: errorConfig
          })
        );
      }

      let encryptedConfigStrategyParams = localCipher.encrypt(response.data.addressSalt, configStrategyParamsString);

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
  * @param ids: strategy ids
  * @return {Promise<Hash>} - returns a Promise with a flat hash of config strategy.
  *
  */
  getByIds: async function(ids) {
    const oThis = this;

    if (ids.length == 0) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'm_tb_dsfhh_y_1',
          api_error_identifier: 'empty_strategy_array',
          debug_options: {},
          error_config: errorConfig
        })
      );
    } else {
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
                api_error_identifier: 'invalid_salt',
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

        const localJsonObj = JSON.parse(localDecryptedParams);
        finalResult[queryResult[i].id] = localJsonObj;
      }

      return Promise.resolve(finalResult);
    }
  },

  /*
  * Get strategy id by passing unencrypted params hash.<br><br>
  *
  * @params {Object} params - hashed_params - SHA of config strategy params.
  * @return {Promise<value>} - returns a Promise with a value of strategy id if it already exists.
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

    var addrSalt = await new ManagedAddressSaltModel().getById(managedAddressSaltId);

    if (!addrSalt[0]) {
      return responseHelper.error({
        internal_error_identifier: 'cm_mas_1',
        api_error_identifier: 'invalid_params',
        error_config: errorConfig
      });
    }

    var KMSObject = new kmsWrapperKlass('managedAddresses');
    var decryptedSalt = await KMSObject.decrypt(addrSalt[0]['managed_address_salt']);
    if (!decryptedSalt['Plaintext']) {
      return responseHelper.error({
        internal_error_identifier: 'cm_mas_2',
        api_error_identifier: 'invalid_params',
        error_config: errorConfig
      });
    }

    var salt = decryptedSalt['Plaintext'];

    return Promise.resolve(responseHelper.successWithData({ addressSalt: salt }));
  }
};

Object.assign(ConfigStrategyModel.prototype, ConfigStrategyModelSpecificPrototype);

module.exports = ConfigStrategyModel;