"use strict";

const dynamicGasPriceProvider = require('@ostdotcom/ost-dynamic-gas-price');

const rootPrefix = '../..'
  , baseCache = require(rootPrefix + '/lib/cache_management/base')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.general)
;

/**
 * @constructor
 * @augments baseCache
 */
const EstimateValueChainGasPriceCacheKlass = function() {
  const oThis = this
  ;

  baseCache.call(this, {});
  oThis.useObject = false;
};

EstimateValueChainGasPriceCacheKlass.prototype = Object.create(baseCache.prototype);

const EstimateValueChainGasPriceCachePrototype = {

  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {

    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + "c_evc_gp_" + chainInteractionConstants.VALUE_CHAIN_ID;

    return oThis.cacheKey;

  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {

    const oThis = this;

    oThis.cacheExpiry = 600; // 10 minutes

    return oThis.cacheExpiry;

  },


  /**
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {

    const oThis = this;

    let gasPriceToBeSubmittedHex = chainInteractionConstants.DEFAULT_VALUE_GAS_PRICE; //DEFAULT_VALUE_GAS_PRICE is in hex
    return Promise.resolve(responseHelper.successWithData(gasPriceToBeSubmittedHex));

  }

};

Object.assign(EstimateValueChainGasPriceCacheKlass.prototype, EstimateValueChainGasPriceCachePrototype);

module.exports = EstimateValueChainGasPriceCacheKlass;