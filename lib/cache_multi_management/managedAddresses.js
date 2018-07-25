'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_multi_management/base'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 */
const managedAddressCache = function(params) {
  const oThis = this;

  oThis.uuids = params['uuids'];

  baseCache.call(this, params);

  oThis.useObject = true;
};

managedAddressCache.prototype = Object.create(baseCache.prototype);

managedAddressCache.prototype.constructor = managedAddressCache;

/**
 * set cache key
 *
 * @return {Object}
 */
managedAddressCache.prototype.setCacheKeys = function() {
  const oThis = this;

  oThis.cacheKeys = {};
  for (var i = 0; i < oThis.uuids.length; i++) {
    oThis.cacheKeys[oThis._cacheKeyPrefix() + 'cma_ma_u_' + oThis.uuids[i]] = oThis.uuids[i];
  }

  return oThis.cacheKeys;
};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
managedAddressCache.prototype.setCacheExpiry = function() {
  const oThis = this;

  oThis.cacheExpiry = 300; // 5 minutes

  return oThis.cacheExpiry;
};

/**
 * fetch data from source
 *
 * @return {Result}
 */
managedAddressCache.prototype.fetchDataFromSource = async function(cacheIds) {
  const oThis = this;

  if (!cacheIds) {
    return responseHelper.error({
      internal_error_identifier: 'cmm_ma_1',
      api_error_identifier: 'blank_uuids',
      error_config: errorConfig
    });
  }

  const queryResponse = await new ManagedAddressModel().getByUuids(cacheIds);

  if (!queryResponse) {
    return responseHelper.error({
      internal_error_identifier: 'cmm_ma_2',
      api_error_identifier: 'no_data_found',
      error_config: errorConfig
    });
  }

  var formattedResponse = {};
  for (var i = 0; i < queryResponse.length; i++) {
    var rawResponse = queryResponse[i];
    formattedResponse[rawResponse.uuid] = {
      client_id: rawResponse.client_id,
      name: rawResponse.name,
      id: rawResponse.id,
      ethereum_address: rawResponse.ethereum_address,
      passphrase_d: 'no_password', // as for these addresses we use private keys send dummy passowrd to bypass Platform validation
      properties: new ManagedAddressModel().getAllBits('properties', rawResponse.properties),
      status: new ManagedAddressModel().statuses[rawResponse.status],
      address_type: parseInt(rawResponse.address_type)
    };
  }

  return responseHelper.successWithData(formattedResponse);
};

module.exports = managedAddressCache;
