"use strict";

const rootPrefix = '../..'
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , cacheImplementer = require(rootPrefix + '/lib/cache_management/saas_only_cache_engine')
    , maxTransactionsThreshold = 1000
  ;

/**
 * @constructor
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ClientTransactionsRateLimitKlass = function(params) {

  const oThis = this;

  oThis.clientId = params.client_id;

  oThis.cacheImplementer = cacheImplementer;

  oThis._setCacheKey();

  oThis._setCacheExpiry();

};

ClientTransactionsRateLimitKlass.prototype = {

  /**
   * set cache key
   *
   * @return {String}
   */
  _setCacheKey: function() {

    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + "c_tr_rl_" + oThis.clientId ;

    return oThis.cacheKey;

  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  _setCacheExpiry: function() {

    const oThis = this;

    oThis.cacheExpiry = 120; // 2 minutes

    return oThis.cacheExpiry;

  },

  /**
   * cache key prefix
   *
   * @return {String}
   */
  _cacheKeyPrefix: function () {
    return 'saas_' + coreConstants.ENVIRONMENT_SHORT + '_' + coreConstants.SUB_ENVIRONMENT_SHORT + '_';
  },

  /**
   * Set Cache For Cache Key.
   *
   * @private
   */
  _setCache: function(){
    const oThis = this;

    return oThis.cacheImplementer.set(oThis.cacheKey, 1, oThis.cacheExpiry);
  },

  /**
   * Increment Transaction Count for a client.
   *
   * @return {Promise<any>}
   */
  _incrementTransactionCount: async function(){
    const oThis = this;

    var resp = await oThis.cacheImplementer.increment(oThis.cacheKey, 1)
      , count = 0;

    if(resp.isFailure()){
      oThis._setCache();
      count = 1;
    } else {
      count = resp.data.response;
    }

    return Promise.resolve(responseHelper.successWithData({trxCount: count}));
  },

  transactionRateLimitCrossed: async function(){
    const oThis = this;

    var result = await oThis._incrementTransactionCount();

    if(result.isFailure()){
      return Promise.resolve(result);
    }

    var lc = result.data.trxCount > maxTransactionsThreshold;
    return Promise.resolve(responseHelper.successWithData({limitCrossed: lc}));
  }

};

module.exports = ClientTransactionsRateLimitKlass;