"use strict";

const rootPrefix = '../..'
    , baseCache = require(rootPrefix + '/lib/cache_management/base')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
;


/**
 * @constructor
 * @augments NounceCacheKlass
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const NounceCacheKlass = function(params) {

  const oThis = this
  ;

  oThis.address = params['address']
  oThis.web3Provider = params['web3Provider']
  oThis.chainId = oThis.web3Provider.chainId;
  
  baseCache.call(this, params);

};

NounceCacheKlass.prototype = Object.create(baseCache.prototype);

const NounceCacheKlassPrototype = {

  /**
   * Set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {

    const oThis = this
    ;

    oThis.cacheKey = `${oThis._cacheKeyPrefix()}nounce_${oThis.chainId}_${oThis.address}`;
    
    return oThis.cacheKey;

  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {

    const oThis = this
    ;

    oThis.cacheExpiry = 600; // 10 minutes
    
    return oThis.cacheExpiry;

  },

  /**
   * Get nounce from the chain
   *
   * @return {promise<result>} - On success, data.value has value. On failure, error details returned.
   */
  getNounceFromChain: function() {
    const oThis = this
    ;

    oThis.clear();
    return oThis.fetch();

  },

  /**
   * Get nounce. This gets the nounce from cache then increments and returns. If not in cache it gets from chain
   *
   * @return {Promise<Result>} - On success, data.value has value. On failure, error details returned.
   */
  getNounce: function() {
    const oThis = this
    return oThis._increament();
  },

  /**
   * Get nounce. This gets the nounce from cache then increments and returns. If not in cache it gets from chain
   *
   * @return {promise<result>} - On success, data.value has value. On failure, error details returned.
   */
  _increament: async function(){
    const oThis = this
     , cacheFetchResponse = await oThis.cacheImplementer.get(oThis.cacheKey);
    ;

    if (cacheFetchResponse.isSuccess()) {
      return Promise.Resolve(oThis.cacheImplementer.increment(oThis.cacheKey, 1));
    } else {
      return Promise.Resolve(oThis.fetch());
    }
  },
  
  /**
   * fetch data from source
   *
   * @return {result}
   */
  fetchDataFromSource: async function() {

    const oThis = this
    ;

    try {
      const transactionCountResult = await oThis.web3Provider.eth.getTransactionCount(oThis.address);
      if (transactionCountResult) {
        return responseHelper.successWithData(transactionCountResult);
      }
      
      return responseHelper.error('l_cm_nm_fetchDataFromSource_1', 'unable to get nounce');
    } catch (err) {
      //Format the error
      logger.error("lib/cache_management/nounce_management.js:fetchDataFromSource inside catch ", err);
      return responseHelper.error('l_cm_nm_fetchDataFromSource_2', 'Something went wrong');
    }
  }

};

Object.assign(NounceCacheKlass.prototype, NounceCacheKlassPrototype);

module.exports = NounceCacheKlass;
