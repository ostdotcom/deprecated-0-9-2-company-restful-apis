"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
    , clientBrandedToken = new ClientBrandedTokenKlass()
    , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
    , managedAddress = new ManagedAddressKlass()
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * @constructor
 * @augments clientBrandedTokenSecureCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const clientBrandedTokenSecureCache = module.exports = function(params) {

  const oThis = this;

  oThis.tokenSymbol = params['tokenSymbol'];
  params['useObject'] = true;

  baseCache.call(this, params);

  oThis.useObject = true;

};

clientBrandedTokenSecureCache.prototype = Object.create(baseCache.prototype);

clientBrandedTokenSecureCache.prototype.constructor = clientBrandedTokenSecureCache;

/**
 * set cache key
 *
 * @return {String}
 */
clientBrandedTokenSecureCache.prototype.setCacheKey = function() {

  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + "cbt_s_" + oThis.tokenSymbol ;

  return oThis.cacheKey;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
clientBrandedTokenSecureCache.prototype.setCacheExpiry = function() {

  const oThis = this;

  oThis.cacheExpiry = 86400 // 24 hours ;

  return oThis.cacheExpiry;

};

/**
 * fetch data from source
 *
 * @return {Result}
 */
clientBrandedTokenSecureCache.prototype.fetchDataFromSource = async function() {

  const oThis = this;

  if (!oThis.tokenSymbol) {
    return responseHelper.error(
        'cm_cbtc_1', 'blank tokenSymbol'
    );
  }

  const response = await clientBrandedToken.getBySymbol(oThis.tokenSymbol)
      , tokenDetails = response[0]
  ;

  if (!response) {
    return responseHelper.error(
        'cm_cbtc_2', 'invalid tokenSymbol'
    );
  }

  const formattedTokenDetails = {
    'conversion_factor': tokenDetails.conversion_factor,
    'symbol': tokenDetails.symbol,
    'client_id': tokenDetails.client_id,
    'token_erc20_address': tokenDetails.token_erc20_address,
    'simple_stake_contract_addr': tokenDetails.simple_stake_contract_addr
  };

  const managedAddressData = await managedAddress.getByIds([tokenDetails.reserve_managed_address_id]);
  formattedTokenDetails.reserve_address_e = managedAddressData.ethereum_address
  formattedTokenDetails.passphrase_e = managedAddressData.passphrase

  return responseHelper.successWithData(formattedTokenDetails);

};