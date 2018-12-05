'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_multi_management/base'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 */
const Erc20ContractAddressCacheKlass = function(params) {
  const oThis = this;

  oThis.addresses = params['addresses'];
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '1';
  oThis.chainId = params['chain_id'];

  baseCache.call(oThis, params);

  oThis.useObject = true;
};

Erc20ContractAddressCacheKlass.prototype = Object.create(baseCache.prototype);

const Erc20ContractAddressCachePrototype = {
  /**
   * set cache key
   *
   * @return {Object}
   */
  setCacheKeys: function() {
    const oThis = this;

    oThis.cacheKeys = {};
    for (let i = 0; i < oThis.addresses.length; i++) {
      oThis.cacheKeys[
        oThis._cacheKeyPrefix() + 'cma_eca_ca_' + oThis.chainId + '_' + oThis.addresses[i].toLowerCase()
      ] = oThis.addresses[i].toLowerCase();
    }

    return oThis.cacheKeys;
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
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function(cacheMissContractAddrs) {
    const oThis = this;

    if (!cacheMissContractAddrs) {
      return responseHelper.error({
        internal_error_identifier: 'cmm_eca_1',
        api_error_identifier: 'blank_addresses',
        error_config: errorConfig
      });
    }

    const queryResponse = await new ClientBrandedTokenModel()
      .select(['id', 'client_id', 'token_erc20_address', 'symbol'])
      .where(['token_erc20_address IN (?) AND chain_id = ?', cacheMissContractAddrs, oThis.chainId])
      .fire();

    if (!queryResponse) {
      return responseHelper.error({
        internal_error_identifier: 'cmm_eca_2',
        api_error_identifier: 'no_data_found',
        error_config: errorConfig
      });
    }

    let formattedResponse = {};
    for (let i = 0; i < queryResponse.length; i++) {
      let rawResponse = queryResponse[i];
      formattedResponse[rawResponse.token_erc20_address.toLowerCase()] = {
        client_id: rawResponse.client_id,
        client_token_id: rawResponse.id,
        symbol: rawResponse.symbol
      };
    }

    return Promise.resolve(responseHelper.successWithData(formattedResponse));
  }
};

Object.assign(Erc20ContractAddressCacheKlass.prototype, Erc20ContractAddressCachePrototype);

InstanceComposer.registerShadowableClass(Erc20ContractAddressCacheKlass, 'getErc20ContractAddressCache');

module.exports = Erc20ContractAddressCacheKlass;
