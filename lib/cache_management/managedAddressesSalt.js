"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , ManagedAddressSaltModel = require(rootPrefix + '/app/models/managed_address_salt')
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , localCipher = require(rootPrefix + '/lib/encryptors/local_cipher')
    , kmsWrapperKlass = require(rootPrefix + '/lib/authentication/kms_wrapper')
;

/**
 * @constructor
 * @augments Client address manager salt caching
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const managedAddressSaltCache = module.exports = function(params) {

  const oThis = this;

  params['useObject'] = true;

  oThis.managedAddressSaltId = params['id'];

  baseCache.call(this, params);

  oThis.useObject = true;

};

managedAddressSaltCache.prototype = Object.create(baseCache.prototype);

managedAddressSaltCache.prototype.constructor = managedAddressSaltCache;

/**
 * set cache key
 *
 * @return {String}
 */
managedAddressSaltCache.prototype.setCacheKey = function() {

  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + "cma_" + oThis.managedAddressSaltId ;

  return oThis.cacheKey;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
managedAddressSaltCache.prototype.setCacheExpiry = function() {

  const oThis = this;

  oThis.cacheExpiry = 86400 // 24 hours ;

  return oThis.cacheExpiry;

};

/**
 * fetch data from source and return client secrets using local encryption
 *
 * @return {Result}
 */
managedAddressSaltCache.prototype.fetchDataFromSource = async function() {

  const oThis = this;

  var addrSalt = await new ManagedAddressSaltModel().getById(oThis.managedAddressSaltId);

  if(!addrSalt[0]) {
    return responseHelper.error("cm_cas_1", "Not found");
  }

  var KMSObject = new kmsWrapperKlass('managedAddresses');
  var decryptedSalt = await KMSObject.decrypt(addrSalt[0]["managed_address_salt"]);
  if(!decryptedSalt["Plaintext"]){
    return responseHelper.error("cm_cas_2", "Address salt invalid.");
  }

  var salt = decryptedSalt["Plaintext"];
  var addrSaltEncr = await localCipher.encrypt(coreConstants.CACHE_SHA_KEY, salt.toString('hex'));

  var data = {addressSalt: addrSaltEncr};

  return responseHelper.successWithData(data);

};