"use strict";

const rootPrefix = '../..'
  , baseCache = require(rootPrefix + '/lib/cache_management/base')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.general)
;

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const clientBrandedTokenSecureCache = function(params) {
  const oThis = this
  ;

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

  oThis.cacheExpiry = 86400; // 24 hours ;

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
    return responseHelper.error({
      internal_error_identifier: 'cm_cbtc_1',
      api_error_identifier: 'missing_token_symbol',
      debug_options: {},
      error_config: errorConfig
    });
  }

  const response = await new ClientBrandedTokenModel().getBySymbol(oThis.tokenSymbol)
      , tokenDetails = response[0]
  ;

  if (!tokenDetails) {
    return responseHelper.error({
      internal_error_identifier: 'cm_cbtc_2',
      api_error_identifier: 'invalid_api_params',
      params_error_identifiers: ['invalid_token_symbol'],
      debug_options: {},
      error_config: errorConfig
    });
  }

  const formattedTokenDetails = {
    'id': tokenDetails.id,
    'conversion_factor': tokenDetails.conversion_factor,
    'symbol': tokenDetails.symbol,
    'client_id': tokenDetails.client_id,
    'token_erc20_address': tokenDetails.token_erc20_address,
    'simple_stake_contract_addr': tokenDetails.simple_stake_contract_addr,
    'airdrop_contract_address': tokenDetails.airdrop_contract_addr
  };

  const managedAddressData = await new ManagedAddressModel().getByIds([tokenDetails.reserve_managed_address_id]);
  for(var i=0;i<managedAddressData.length;i++){
    var row = managedAddressData[i];
    if(row.id == tokenDetails.reserve_managed_address_id){
      formattedTokenDetails.reserve_address_uuid = row.uuid;
      formattedTokenDetails.reserve_address = row.ethereum_address
    }
  }

  return responseHelper.successWithData(formattedTokenDetails);

};

module.exports = clientBrandedTokenSecureCache;