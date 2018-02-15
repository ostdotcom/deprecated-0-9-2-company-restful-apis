"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
    , clientBrandedToken = new ClientBrandedTokenKlass()
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * @constructor
 * @augments clientBrandedTokenCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const clientBrandedTokenCache = module.exports = function(params) {

  const oThis = this;

  oThis.clientId = params['clientId'];

  baseCache.call(this, params);

};

clientBrandedTokenCache.prototype = Object.create(baseCache.prototype);

clientBrandedTokenCache.prototype.constructor = clientBrandedTokenCache;

/**
 * set cache key
 *
 * @return {String}
 */
clientBrandedTokenCache.prototype.setCacheKey = function() {

  const oThis = this;

  oThis.cacheKey = oThis._cacheKeyPrefix() + "cbt_" + oThis.clientId ;

  return oThis.cacheKey;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
clientBrandedTokenCache.prototype.setCacheExpiry = function() {

  const oThis = this;

  oThis.cacheExpiry = 300 // 5 minutes ;

  return oThis.cacheExpiry;

};

/**
 * fetch data from source
 *
 * @return {Result}
 */
clientBrandedTokenCache.prototype.fetchDataFromSource = async function() {

  const oThis = this;

  const response = await clientBrandedToken.getByClientId(oThis.clientId)
  , lastTokenDetails = response[response.length - 1]
  , formattedLastTokenDetails = {
    'conversion_rate': lastTokenDetails.conversion_rate,
    'symbol': lastTokenDetails.symbol
  };

  return responseHelper.successWithData(formattedLastTokenDetails);

};