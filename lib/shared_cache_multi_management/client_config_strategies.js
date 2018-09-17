'use strict';

/**
 * Class to get client config strategy details from cache. Extends the baseCache class.
 *
 * @module /lib/shared_cache_multi_management/client_config_strategies
 */

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/shared_cache_multi_management/base'),
  ClientConfigStrategiesModel = require(rootPrefix + '/app/models/client_config_strategies'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management');

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ClientConfigStrategiesCacheKlass = function(params) {
  const oThis = this;

  oThis.clientIds = params['clientIds'];
  oThis.cacheType = cacheManagementConst.shared_memcached;
  oThis.consistentBehavior = '0';

  baseCache.call(oThis, params);
  oThis.useObject = true;
};

ClientConfigStrategiesCacheKlass.prototype = Object.create(baseCache.prototype);

const ClientConfigStrategiesCacheKlassPrototype = {
  /**
   * set cache keys
   *
   * @return {Object}
   */
  setCacheKeys: function() {
    const oThis = this;

    oThis.cacheKeys = {};

    for (let i = 0; i < oThis.clientIds.length; i++) {
      oThis.cacheKeys[oThis._cacheKeyPrefix() + 'cs_ccs_' + oThis.clientIds[i]] = oThis.clientIds[i].toString();
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

    oThis.cacheExpiry = 86400 * 30; // 30 days;

    return oThis.cacheExpiry;
  },

  /**
   * Fetch data from source.
   *
   * @return {Promise}
   */
  fetchDataFromSource: async function(cacheMissClientIds) {
    const oThis = this,
      clientConfigStrategiesModelObj = new ClientConfigStrategiesModel(),
      queryResponses = await clientConfigStrategiesModelObj.getByClientIds(cacheMissClientIds);

    if (!queryResponses) {
      return responseHelper.error({
        internal_error_identifier: 'scmm_ccs_1',
        api_error_identifier: 'no_data_found',
        error_config: errorConfig
      });
    }

    let formattedResponse = {};

    for (let i = 0; i < queryResponses.length; i++) {
      let queryResponse = queryResponses[i];

      if (!formattedResponse[queryResponse.client_id]) {
        formattedResponse[queryResponse.client_id] = {
          configStrategyIds: [],
          shard_names: {}
        };
      }

      formattedResponse[queryResponse.client_id]['configStrategyIds'].push(queryResponse['config_strategy_id']);

      if (queryResponse.auxilary_data !== null) {
        formattedResponse[queryResponse.client_id]['shard_names'] = JSON.parse(queryResponse.auxilary_data);
      }
    }

    return Promise.resolve(responseHelper.successWithData(formattedResponse));
  }
};

Object.assign(ClientConfigStrategiesCacheKlass.prototype, ClientConfigStrategiesCacheKlassPrototype);

module.exports = ClientConfigStrategiesCacheKlass;
