'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ClientUsersCntCacheKlass = function(params) {
  const oThis = this;

  oThis.clientId = params['client_id'];
  baseCache.call(this, params);
  oThis.useObject = false;
};

ClientUsersCntCacheKlass.prototype = Object.create(baseCache.prototype);

const ClientUsersCntCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'c_us_cnt_' + oThis.clientId;

    return oThis.cacheKey;
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    const oThis = this;

    oThis.cacheExpiry = 1800; // 30 minutes

    return oThis.cacheExpiry;
  },
  /**
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {
    const oThis = this,
      response = await new ManagedAddressModel().getFilteredActiveUsersCount({ client_id: oThis.clientId }),
      count = response[0].total_count;

    //NOTE: storing str in it as of now. As facing problems with setting int 0 as cache value
    return Promise.resolve(responseHelper.successWithData(count));
  }
};

Object.assign(ClientUsersCntCacheKlass.prototype, ClientUsersCntCacheKlassPrototype);

module.exports = ClientUsersCntCacheKlass;
