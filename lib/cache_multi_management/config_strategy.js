'use strict';

/**
 * Class to get client config strategy details from cache. Extends the baseCache class.
 *
 * @module /lib/cache_multi_management/config_strategy
 */

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic');

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 */
const ConfigStrategyCache = function(params) {
  const oThis = this;

  oThis.strategyIds = params['strategyIds'];

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
    oThis.cacheKeys[oThis._cacheKeyPrefix() + 'cs_scale_out_' + oThis.strategyIds[i].toLowerCase()] = oThis.strategyIds[
      i
    ].toLowerCase();
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
  console.log('In set cache expiry');
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

  const configStrategyModelObj = new ConfigStrategyModel();

  const queryResponse = await configStrategyModelObj.getConfig(cacheMissStrategyIds);

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
