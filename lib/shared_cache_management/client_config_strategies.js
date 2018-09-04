'use strict';

/**
 * Class to get client config strategy details from cache. Extends the baseCache class.
 *
 * @module /lib/shared_cache_management/client_config_strategies
 */

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/shared_cache_management/base'),
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

  oThis.clientId = params['clientId'];
  oThis.cacheType = cacheManagementConst.shared_memcached;
  oThis.consistentBehavior = '0';

  baseCache.call(oThis, params);
  oThis.useObject = true;
};

ClientConfigStrategiesCacheKlass.prototype = Object.create(baseCache.prototype);

const ClientConfigStrategiesCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'ccs_' + oThis.clientId;

    return oThis.cacheKey;
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
  fetchDataFromSource: async function() {
    const oThis = this,
      response = await new ClientConfigStrategiesModel().getByClientId(oThis.clientId);

    let configStrategyIds = [],
      shard_names = null;
    for (let i = 0; i < response.length; i++) {
      configStrategyIds.push(response[i].config_strategy_id);
      if (response[i].auxilary_data !== null) {
        shard_names = JSON.parse(response[i].auxilary_data);
      }
    }

    return Promise.resolve(
      responseHelper.successWithData({ configStrategyIds: configStrategyIds, shard_names: shard_names })
    );
  }
};

Object.assign(ClientConfigStrategiesCacheKlass.prototype, ClientConfigStrategiesCacheKlassPrototype);

module.exports = ClientConfigStrategiesCacheKlass;
