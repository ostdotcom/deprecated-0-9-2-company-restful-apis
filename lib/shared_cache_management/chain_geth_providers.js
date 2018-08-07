'use strict';

/**
 * Class to get sibling geth provider details from cache. Extends the baseCache class.
 *
 * @module /lib/shared_cache_management/chain_geth_providers
 */

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/shared_cache_management/base'),
  ChainGethProvidersModel = require(rootPrefix + '/app/models/chain_geth_providers'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management');

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ChainGethProvidersCacheKlass = function(params) {
  const oThis = this;

  oThis.gethProvider = params['gethProvider'];
  oThis.cacheType = cacheManagementConst.in_memory;
  oThis.consistentBehavior = '0';

  baseCache.call(oThis, params);
  oThis.useObject = true;
};

ChainGethProvidersCacheKlass.prototype = Object.create(baseCache.prototype);

const ChainGethProvidersCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'cgp_' + oThis.gethProvider;

    return oThis.cacheKey;
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
   * Fetch data from source.
   *
   * @return {Promise}
   */
  fetchDataFromSource: async function() {
    const oThis = this,
      response = await new ChainGethProvidersModel().getSiblingProviders(oThis.gethProvider);
    return Promise.resolve(responseHelper.successWithData(response));
  }
};

Object.assign(ChainGethProvidersCacheKlass.prototype, ChainGethProvidersCacheKlassPrototype);

module.exports = ChainGethProvidersCacheKlass;
