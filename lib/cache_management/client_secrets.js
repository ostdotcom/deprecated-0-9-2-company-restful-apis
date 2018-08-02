'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ClientAPICredentialModel = require(rootPrefix + '/app/models/client_api_credential'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  localCipher = require(rootPrefix + '/lib/encryptors/local_cipher'),
  kmsWrapperKlass = require(rootPrefix + '/lib/authentication/kms_wrapper'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * @constructor
 * @augments Client secret key caching
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ClientSecretsCacheKlass = function(params) {
  const oThis = this;

  oThis.apiKey = params['api_key'];
  oThis.cacheType = cacheManagementConst.shared_memcached;
  oThis.consistentBehavior = '1';

  params['useObject'] = true;
  baseCache.call(oThis, params);

  oThis.useObject = true;
};

ClientSecretsCacheKlass.prototype = Object.create(baseCache.prototype);

const ClientSecretsCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    // It uses shared cache key between company api and saas.
    oThis.cacheKey = oThis._sharedCacheKeyPrefix() + 'cs_' + oThis.apiKey;

    return oThis.cacheKey;
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    const oThis = this;

    oThis.cacheExpiry = 86400; // 24 hours

    return oThis.cacheExpiry;
  },

  /**
   * fetch data from source and return client secrets using local encryption
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {
    const oThis = this;

    var clientApiCredentialData = await new ClientAPICredentialModel().getClientApi(oThis.apiKey);

    if (!clientApiCredentialData[0]) {
      return responseHelper.error({
        internal_error_identifier: 'cm_cs_1',
        api_error_identifier: 'invalid_or_expired_token',
        error_config: errorConfig
      });
    }
    const dbRecord = clientApiCredentialData[0];

    var KMSObject = new kmsWrapperKlass('clientValidation');
    var decryptedSalt = await KMSObject.decrypt(dbRecord['api_salt']);
    if (!decryptedSalt['Plaintext']) {
      return responseHelper.error({
        internal_error_identifier: 'cm_cs_2',
        api_error_identifier: 'invalid_or_expired_token',
        error_config: errorConfig
      });
    }
    var infoSalt = decryptedSalt['Plaintext'];

    var apiSecret = await localCipher.decrypt(infoSalt, dbRecord['api_secret']);

    var apiSecretEncr = await localCipher.encrypt(coreConstants.CACHE_SHA_KEY, apiSecret);

    return Promise.resolve(
      responseHelper.successWithData({
        clientId: dbRecord['client_id'],
        apiKey: oThis.apiKey,
        apiSecret: apiSecretEncr,
        expiryTimestamp: dbRecord['expiry_timestamp']
      })
    );
  }
};

Object.assign(ClientSecretsCacheKlass.prototype, ClientSecretsCacheKlassPrototype);

InstanceComposer.registerShadowableClass(ClientSecretsCacheKlass, 'getClientSecretsCache');

module.exports = ClientSecretsCacheKlass;
