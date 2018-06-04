"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_multi_management/base')
    , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
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
 */
const erc20ContractAddressCache = function (params) {

  const oThis = this;

  oThis.addresses = params['addresses'];

  baseCache.call(this, params);

  oThis.useObject = false;

};

erc20ContractAddressCache.prototype = Object.create(baseCache.prototype);

erc20ContractAddressCache.prototype.constructor = erc20ContractAddressCache;

/**
 * set cache key
 *
 * @return {Object}
 */
erc20ContractAddressCache.prototype.setCacheKeys = function () {

  const oThis = this;

  oThis.cacheKeys = {};
  for (var i = 0; i < oThis.addresses.length; i++) {
    oThis.cacheKeys[oThis._cacheKeyPrefix() + "cma_eca_ca_" + oThis.addresses[i].toLowerCase()] = oThis.addresses[i].toLowerCase();
  }

  return oThis.cacheKeys;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
erc20ContractAddressCache.prototype.setCacheExpiry = function () {

  const oThis = this;

  oThis.cacheExpiry = 86400; // 24 hours

  return oThis.cacheExpiry;

};

/**
 * fetch data from source
 *
 * @return {Result}
 */
erc20ContractAddressCache.prototype.fetchDataFromSource = async function (cacheMissContractAddrs) {

  const oThis = this;

  if (!cacheMissContractAddrs) {
    return responseHelper.error({
      internal_error_identifier: 'cmm_eca_1',
      api_error_identifier: 'blank_addresses',
      error_config: errorConfig
    });
  }

  const queryResponse = await new ClientBrandedTokenModel().select(['id', 'client_id', 'token_erc20_address', 'symbol'])
      .where(['token_erc20_address IN (?)', cacheMissContractAddrs]).fire();

  if (!queryResponse) {
    return responseHelper.error({
      internal_error_identifier: 'cmm_eca_2',
      api_error_identifier: 'no_data_found',
      error_config: errorConfig
    });
  }

  var formattedResponse = {};
  for (var i = 0; i < queryResponse.length; i++) {
    var rawResponse = queryResponse[i];
    formattedResponse[rawResponse.token_erc20_address.toLowerCase()] = {
      'client_id': rawResponse.client_id,
      'client_token_id': rawResponse.id,
      'symbol': rawResponse.symbol
    };
  }

  return responseHelper.successWithData(formattedResponse);

};

module.exports = erc20ContractAddressCache;