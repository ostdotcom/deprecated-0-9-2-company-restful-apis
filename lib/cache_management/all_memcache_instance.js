"use strict";

const Memcached = require('memcached');

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix+'/lib/logger/custom_console_logger')
;
Object.assign(Memcached.config, {retries: 1, timeout: 500, reconnect: 1000, poolSize: 200});

/**
 * constructor
 *
 * @constructor
 */
const allMemcacheInstanceKlass = function() {

  const oThis = this;

};

allMemcacheInstanceKlass.prototype = {

  /**
   * Clear data from all cache instance
   *
   * @param {string} key - key whose cache needs to be cleared
   *
   * @return {promise<result>}
   */
  clearCache: async function (key) {
    const oThis = this
    ;

    try {

      // error handling
      if (oThis.validateCacheKey(key) === false) {
        return Promise.resolve(responseHelper.error('l_cm_aic_clearCache_1', 'Cache key validation failed'));
      }

      const endPointsResponse = await oThis._getEndPoints();
      if (endPointsResponse.isFailure()) return Promise.resolve(endPointsResponse);

      const successEndpoint = new Array();
      const failedEndpoint = new Array();

      for (var index in endPointsResponse.data.endPoints){
        const endPoint = endPointsResponse.data.endPoints[index];
        const clearResponse = await oThis._clear(endPoint.trim(), key);
        if (clearResponse.isSuccess()) {
          successEndpoint.push(endPoint);
        } else {
          failedEndpoint.push(endPoint);
        }
      }

      return Promise.resolve(responseHelper.successWithData({successEndpoint: successEndpoint, failedEndpoint: failedEndpoint}));

    } catch (err) {
      //Format the error
      logger.error("lib/cache_management/all_instance_cache.js:clearCache:wait inside catch ", err);
      return onResolve(responseHelper.error('l_cm_aic_clearCache_2', 'Something went wrong'));
    }

  },

  /**
   * Get end points of memcached servers
   *
   * @return {promise<result>}
   */
  _getEndPoints: function () {
    if (!coreConstants.MEMCACHE_SERVERS){
      return Promise.resolve(responseHelper.error("l_cm_aic_getEndPoints_1", "OST_MEMCACHE_SERVERS not available"));
    }
    const endPoints = coreConstants.MEMCACHE_SERVERS.split(',');

    return Promise.resolve(responseHelper.successWithData({endPoints: endPoints}));
  },

  /**
   * Clear data from given endpoint server
   *
   * @param {string} endPoint - Memcache server endpoint
   * @param {string} key - key whose cache needs to be cleared
   *
   * @return {promise<result>}
   */
  _clear: function (endPoint, key) {
    const oThis = this
    ;

    return new Promise(function (onResolve, onReject) {

      try {
        const client = new Memcached(endPoint);

        // Error handling
        client.on('issue', function( details ){logger.error("Issue with Memcache server. Trying to resolve!")});
        client.on('failure', function( details ){ logger.error( "Server " + details.server + "went down due to: " + details.messages.join( '' ) ) });
        client.on('reconnecting', function( details ){ logger.error( "Total downtime caused by server " + details.server + " :" + details.totalDownTime + "ms")});

        // Set callback method
        var callback = function (err, data) {
          if (err) {
            onResolve(responseHelper.error('l_cm_aic_clear_2', err));
          } else {
            onResolve(responseHelper.successWithData({response: true}));
          }
        };

        // Perform action
        client.del(key, callback);

      } catch(err) {
        //Format the error
        logger.error("lib/cache_management/all_instance_cache.js:_clear:wait inside catch ", err);
        return onResolve(responseHelper.error('l_cm_aic_clear_3', 'Something went wrong'));
      }

    });

  },


  validateCacheKey: function (key) {

    var oThis = this;

    if (typeof key !== 'string') {
      logger.error('cache key not a string', key);
      return false;
    }

    if (key === '') {
      logger.error('cache key should not be blank', key);
      return false;
    }

    if (oThis._validateCacheValueSize(key, 250) !== true) {
      logger.error('cache key byte size should not be > 250', key, " size ", oThis._validateCacheValueSize(key, 250));
      return false;
    }

    if (oThis._validateCacheKeyChars(key) !== true) {
      logger.error('cache key has unsupported chars', key);
      return false;
    }

    return true;
  }

  // Check if cache value is valid or not
  , validateCacheValue: function (value) {
    var oThis = this;
    return (value !== undefined && oThis._validateCacheValueSize(value, 1024 * 1024) === true) ? true : false;
  }

  // Check if cache expiry is valid or not
  , validateCacheExpiry: function (value) {
    var oThis = this;
    return (value && (typeof value === 'number')) ? true : false;
  }

  // check if cache value size is < size
  , _validateCacheValueSize: function (value, size) {
    return Buffer.byteLength(JSON.stringify(value), 'utf8') <= size ? true : false;
  }

  // check key has valid chars
  , _validateCacheKeyChars: function (key) {
    return /\s/.test(key) ? false : true;
  }
  
  
};

module.exports = allMemcacheInstanceKlass;
