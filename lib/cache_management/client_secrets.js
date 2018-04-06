"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , clientApiCredential = require(rootPrefix + '/app/models/client_api_credential')
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , localCipher = require(rootPrefix + '/lib/encryptors/local_cipher')
    , kmsWrapperKlass = require(rootPrefix + '/lib/authentication/kms_wrapper')
;

/**
 * @constructor
 * @augments Client secret key caching
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const clientSecretsCache = module.exports = function(params) {

  const oThis = this;

  oThis.apiKey = params['api_key'];
  params['useObject'] = true;

  baseCache.call(this, params);

  oThis.useObject = true;

};

clientSecretsCache.prototype = Object.create(baseCache.prototype);

clientSecretsCache.prototype.constructor = clientSecretsCache;

/**
 * set cache key
 *
 * @return {String}
 */
clientSecretsCache.prototype.setCacheKey = function() {

  const oThis = this;

  // It uses shared cache key between company api and saas.
  oThis.cacheKey = oThis._sharedCacheKeyPrefix() + "cs_" + oThis.apiKey ;

  return oThis.cacheKey;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
clientSecretsCache.prototype.setCacheExpiry = function() {

  const oThis = this;

  oThis.cacheExpiry = 86400 // 24 hours ;

  return oThis.cacheExpiry;

};



/**
 * fetch data from source and return client secrets using local encryption
 *
 * @return {Result}
 */
clientSecretsCache.prototype.fetchDataFromSource = async function() {

  const oThis = this;

  var clientApiCredentialData = await clientApiCredential.getClientApi(oThis.apiKey);

  if (!clientApiCredentialData[0]) {
    return responseHelper.error("cm_cs_1", "Invalid client details.");
  }
  const dbRecord = clientApiCredentialData[0];

  var KMSObject = new kmsWrapperKlass('clientValidation');
  var decryptedSalt = await KMSObject.decrypt(dbRecord["api_salt"]);
  if(!decryptedSalt["Plaintext"]){
    return responseHelper.error("cm_cs_2", "Client salt invalid.");
  }
  var infoSalt = decryptedSalt["Plaintext"];

  var apiSecret = await localCipher.decrypt(infoSalt, dbRecord["api_secret"]);

  var apiSecretEncr = await localCipher.encrypt(coreConstants.CACHE_SHA_KEY, apiSecret);
  return responseHelper.successWithData({
    clientId: dbRecord["client_id"], apiKey: oThis.apiKey,
    apiSecret: apiSecretEncr, expiryTimestamp: dbRecord['expiry_timestamp']
  });

};