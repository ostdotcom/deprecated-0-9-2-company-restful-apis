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
const erc20ContractUuidCache = function (params) {

  const oThis = this;

  oThis.uuids = params['uuids'];

  baseCache.call(this, params);

  oThis.useObject = false;

};

erc20ContractUuidCache.prototype = Object.create(baseCache.prototype);

erc20ContractUuidCache.prototype.constructor = erc20ContractUuidCache;

/**
 * set cache key
 *
 * @return {Object}
 */
erc20ContractUuidCache.prototype.setCacheKeys = function () {

  const oThis = this;

  oThis.cacheKeys = {};
  for (var i = 0; i < oThis.uuids.length; i++) {
    oThis.cacheKeys[oThis._cacheKeyPrefix() + "cma_eua_cu_" + oThis.uuids[i].toLowerCase()] = oThis.uuids[i].toLowerCase();
  }

  return oThis.cacheKeys;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
erc20ContractUuidCache.prototype.setCacheExpiry = function () {

  const oThis = this;

  oThis.cacheExpiry = 86400; // 24 hours

  return oThis.cacheExpiry;

};

/**
 * fetch data from source
 *
 * @return {Result}
 */
erc20ContractUuidCache.prototype.fetchDataFromSource = async function (cacheMissContractUuids) {

  const oThis = this;

  if (!cacheMissContractUuids) {
    return responseHelper.error({
      internal_error_identifier: 'cmm_ecu_1',
      api_error_identifier: 'blank_uuids',
      error_config: errorConfig
    });
  }

  const queryResponse = await new ClientBrandedTokenModel().select(['id', 'token_erc20_address', 'token_uuid', 'client_id'])
      .where(['token_uuid IN (?)', cacheMissContractUuids]).fire();

  if (!queryResponse) {
    return responseHelper.error({
      internal_error_identifier: 'cmm_ecu_2',
      api_error_identifier: 'no_data_found',
      error_config: errorConfig
    });
  }

  var formattedResponse = {};
  for (var i = 0; i < queryResponse.length; i++) {
    var rawResponse = queryResponse[i];
    formattedResponse[rawResponse.token_uuid.toLowerCase()] = {
      'token_erc20_address': rawResponse.token_erc20_address,
      'client_id': rawResponse.client_id
    };
  }

  return responseHelper.successWithData(formattedResponse);

};

module.exports = erc20ContractUuidCache;