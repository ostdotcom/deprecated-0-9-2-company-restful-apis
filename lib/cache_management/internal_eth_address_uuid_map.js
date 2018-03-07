"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , managedAddressKlass = require(rootPrefix + '/app/models/managed_address')
;

/**
 * @constructor
 * @augments internalEthAddrUuidKlass
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const internalEthAddrUuidKlass = module.exports = function(params) {

  const oThis = this;

  oThis.address = params['address'];

  baseCache.call(this, params);

};

internalEthAddrUuidKlass.prototype = Object.create(baseCache.prototype);

internalEthAddrUuidKlass.prototype.constructor = internalEthAddrUuidKlass;

/**
 * set cache key
 *
 * @return {String}
 */
internalEthAddrUuidKlass.prototype.setCacheKey = function() {

  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + "i_eth_a_uuid_mp_" + oThis.address ;

  return oThis.cacheKey;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
internalEthAddrUuidKlass.prototype.setCacheExpiry = function() {

  const oThis = this;

  oThis.cacheExpiry = 86400; // 24 hours

  return oThis.cacheExpiry;

};

/**
 * fetch data from source and return eth balance from VC in Wei
 *
 * @return {Result}
 */
internalEthAddrUuidKlass.prototype.fetchDataFromSource = async function() {

  const oThis = this
      ,  managedAddressObj = new managedAddressKlass();

  const managedAddress = await managedAddressObj.getByEthAddresses([oThis.address]);

  if(!managedAddress[0]){
    return responseHelper.error("cm_mas_1", "Address invalid.");
  }

  return responseHelper.successWithData(managedAddress[0].uuid);

};