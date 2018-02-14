"use strict";

const rootPrefix = '../..'
    , openStCache = require('@openstfoundation/openst-cache')
    , cacheImplementer = openStCache.cache
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , logger = require(rootPrefix+'/lib/logger/custom_console_logger')
;

/**
 * constructor
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 * @constructor
 */
const baseCacheManagementKlass = function(params) {

  const oThis = this;

  if(!params){
    params = {};
  }

  oThis.params = params;

  oThis.useObject = params['useObject'] === true;

  oThis.cacheKey = null;

  oThis.cacheExpiry = null;

  // call sub class method to set cache key using params provided
  oThis.setCacheKey();

};

baseCacheManagementKlass.prototype = {

  /**
   * Fetch data from cache, in case of cache miss calls sub class method to fetch data from source
   *
   * @return {Promise<Result>} - On success, data.value has value. On failure, error details returned.
   */
  fetch: async function () {

    const oThis = this;

    var data = await oThis._fetchFromCache()
    , fetchDataRsp = null;

    // if cache miss call sub class method to fetch data from source and set cache
    if (!data) {

      fetchDataRsp = await oThis.fetchDataFromSource();

      // if fetch from source failed do not set cache and return error response
      if (fetchDataRsp.isFailure()) {
        logger.error(fetchDataRsp);
        return fetchDataRsp;
      } else {
        data = fetchDataRsp.data;
       // DO NOT WAIT for cache being set
        oThis._setCache(data);
      }

    }

    return Promise.resolve(responseHelper.successWithData(data));

  },

  /**
   * clear cache
   *
   * @return {Promise<Result>}
   */
  clear: function () {

    const oThis = this;

    return cacheImplementer.del(oThis.cacheKey);

  },

  // methods which sub class would have to implement

  /**
   * set cache key in oThis.cacheKey and return it
   *
   * @return {String}
   */
  setCacheKey: function() {
    throw 'sub class to implement';
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    throw 'sub class to implement';
  },

  /**
   * fetch data from source
   * return should be of klass Result
   * data attr of return is returned and set in cache
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {
    throw 'sub class to implement';
  },

  // private methods from here

  /**
   * fetch from cache
   *
   * @return {Object}
   */
  _fetchFromCache: async function () {

    const oThis = this;
    var cacheFetchResponse = null
        , cacheData = null;

    if(oThis.useObject) {
      cacheFetchResponse = await cacheImplementer.getObject(oThis.cacheKey);
    } else {
      cacheFetchResponse = await cacheImplementer.get(oThis.cacheKey);
    }

    if (cacheFetchResponse.isSuccess()) {
      cacheData = cacheFetchResponse.data.response;
    }

    return cacheData;

  },

  /**
   * set data in cache.
   *
   * @param {Object} dataToSet - data to se tin cache
   *
   * @return {Result}
   */
  _setCache: function (dataToSet) {

    const oThis = this;

    var setCacheFunction = function() {

      if(oThis.useObject) {
        return cacheImplementer.setObject(oThis.cacheKey, dataToSet, oThis.cacheExpiry);
      } else {
        return cacheImplementer.set(oThis.cacheKey, dataToSet, oThis.cacheExpiry);
      }

    };

    setCacheFunction().then(function(cacheSetResponse){

      if (cacheSetResponse.isFailure()) {
        logger.error(cacheSetResponse);
      }
    });

  },

  /**
   * cache key prefix
   *
   * @return {String}
   */
  _cacheKeyPrefix: function () {
    return 'saas_' + coreConstants.ENVIRONMENT_SHORT + '_' + coreConstants.SUB_ENVIRONMENT_SHORT + '_';
  }

}

module.exports = baseCacheManagementKlass;
