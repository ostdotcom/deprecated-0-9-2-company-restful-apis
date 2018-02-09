"use strict";

const rootPrefix = '../..'
    , openStCache = require('@openstfoundation/openst-cache')
    , cacheImplementer = openStCache.cache
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
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

    var data = await oThis._fetchFromCache();

    // if cache miss call sub class method to fetch data from source and set cache
    if (!data) {
      data = oThis.fetchDataFromSource();
      oThis._setCache(data);
    }

    return Promise.resolve(responseHelper.successWithData(data));

  },

  /**
   * clear cache
   *
   * @return {Promise<Result>}
   */
  clear: async function () {

    const oThis = this;

    return cacheImplementer.del(oThis.cacheKey);

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
   * set data in cache
   *
   * @param {Object} dataToSet - data to se tin cache
   *
   * @return {Result}
   */
  _setCache: async function (dataToSet) {

    const oThis = this;

    var cacheSetResponse = null;

    //NOTE: Using default expiry set in open-st cache as it does not allow for custom param
    if(oThis.useObject) {
      cacheSetResponse = await cacheImplementer.setObject(oThis.cacheKey, dataToSet);
    } else {
      cacheSetResponse = await cacheImplementer.set(oThis.cacheKey, dataToSet);
    }

    if (cacheSetResponse.isFailure()) {
      console.log(cacheFetchResponse);
    }

    return cacheSetResponse;

  },

  /**
   * cache key prefix
   *
   * @return {String}
   */
  _cacheKeyPrefix: function () {
    return coreConstants.ENVIRONMENT + '_' + coreConstants.SUB_ENV + '_';
  }

}

module.exports = baseCacheManagementKlass;
