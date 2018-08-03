'use strict';

/**
 * Class to get client config strategy details from cache. Extends the baseCache class.
 *
 * @module /lib/cache_multi_management/config_strategy
 */

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_multi_management/base'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management');

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 */
const ConfigStrategyCache = function(params) {
  const oThis = this;

  oThis.strategyIds = params['strategyIds'];

  oThis.cacheType = cacheManagementConst.in_memory;

  baseCache.call(this, params);
};

ConfigStrategyCache.prototype = Object.create(baseCache.prototype);

ConfigStrategyCache.prototype.constructor = ConfigStrategyCache;

/**
 * set cache key
 *
 * @return {Object}
 */
ConfigStrategyCache.prototype.setCacheKeys = function() {
  const oThis = this;

  oThis.cacheKeys = {};

  for (let i = 0; i < oThis.strategyIds.length; i++) {
    oThis.cacheKeys[oThis._cacheKeyPrefix() + 'cs_sd_' + oThis.strategyIds[i]] = oThis.strategyIds[i].toString();
  }

  return oThis.cacheKeys;
};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
ConfigStrategyCache.prototype.setCacheExpiry = function() {
  const oThis = this;

  oThis.cacheExpiry = 86400; // 24 hours

  return oThis.cacheExpiry;
};

ConfigStrategyCache.prototype.fetchDataFromSource = async function(cacheMissStrategyIds) {
  const oThis = this;

  if (!cacheMissStrategyIds) {
    return responseHelper.error({
      internal_error_identifier: 'cmm_eca_1_config_strategy',
      api_error_identifier: 'blank_addresses',
      error_config: errorConfig
    });
  }

  const queryResponse = await new ConfigStrategyModel().getByIds(cacheMissStrategyIds);

  if (!queryResponse) {
    return responseHelper.error({
      internal_error_identifier: 'cmm_eca_2',
      api_error_identifier: 'no_data_found',
      error_config: errorConfig
    });
  }

  return responseHelper.successWithData(queryResponse);
};

module.exports = ConfigStrategyCache;
