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
const Erc20ContractUuidCacheKlass = function(params) {
  const oThis = this;

  oThis.uuids = params['uuids'];
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '1';

  baseCache.call(oThis, params);

  oThis.useObject = false;
};

Erc20ContractUuidCacheKlass.prototype = Object.create(baseCache.prototype);

const Erc20ContractUuidCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {Object}
   */
  setCacheKeys: function() {
    const oThis = this;

    oThis.cacheKeys = {};
    for (let i = 0; i < oThis.uuids.length; i++) {
      oThis.cacheKeys[oThis._cacheKeyPrefix() + 'cma_eua_cu_' + oThis.uuids[i].toLowerCase()] = oThis.uuids[
        i
      ].toLowerCase();
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
  fetchDataFromSource: async function(cacheMissContractUuids) {
    const oThis = this;

    if (!cacheMissContractUuids) {
      return responseHelper.error({
        internal_error_identifier: 'cmm_ecu_1',
        api_error_identifier: 'blank_uuids',
        error_config: errorConfig
      });
    }

    const queryResponse = await new ClientBrandedTokenModel()
      .select(['id', 'token_erc20_address', 'token_uuid', 'client_id'])
      .where(['token_uuid IN (?)', cacheMissContractUuids])
      .fire();

    if (!queryResponse) {
      return responseHelper.error({
        internal_error_identifier: 'cmm_ecu_2',
        api_error_identifier: 'no_data_found',
        error_config: errorConfig
      });
    }

    let formattedResponse = {};
    for (let i = 0; i < queryResponse.length; i++) {
      let rawResponse = queryResponse[i];
      formattedResponse[rawResponse.token_uuid.toLowerCase()] = {
        token_erc20_address: rawResponse.token_erc20_address,
        client_id: rawResponse.client_id
      };
    }

    return Promise.resolve(responseHelper.successWithData(formattedResponse));
  }
};

Object.assign(Erc20ContractUuidCacheKlass.prototype, Erc20ContractUuidCacheKlassPrototype);

InstanceComposer.registerShadowableClass(Erc20ContractUuidCacheKlass, 'getErc20ContractUuidCache');

module.exports = Erc20ContractUuidCacheKlass;
