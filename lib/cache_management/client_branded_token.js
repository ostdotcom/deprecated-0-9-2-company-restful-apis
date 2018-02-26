"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
    , clientBrandedToken = new ClientBrandedTokenKlass()
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * @constructor
 * @augments ClientBrandedTokenCacheKlass
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ClientBrandedTokenCacheKlass = function(params) {

  const oThis = this;

  oThis.clientId = params['clientId'];
  params['useObject'] = true;

  baseCache.call(this, params);

  oThis.useObject = true;

};

ClientBrandedTokenCacheKlass.prototype = Object.create(baseCache.prototype);

const ClientBrandedTokenCacheKlassPrototype = {

  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {

    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + "cbt_" + oThis.clientId ;

    return oThis.cacheKey;

  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {

    const oThis = this;

    oThis.cacheExpiry = 86400; // 24 hours ;

    return oThis.cacheExpiry;

  },
  /**
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {

    const oThis = this
      , response = await clientBrandedToken.getByClientId(oThis.clientId)
      , tokenDetails = response[0];

    const formattedTokenDetails = {
      'client_id': tokenDetails.client_id,
      'name': tokenDetails.name,
      'symbol': tokenDetails.symbol,
      'symbol_icon': tokenDetails.symbol_icon,
      'conversion_factor': tokenDetails.conversion_factor
    };

    return Promise.resolve(responseHelper.successWithData(formattedTokenDetails));

  }


};

Object.assign(ClientBrandedTokenCacheKlass.prototype, ClientBrandedTokenCacheKlassPrototype);

module.exports = ClientBrandedTokenCacheKlass;