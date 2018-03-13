"use strict";

const rootPrefix = '../..'
  , baseCache = require(rootPrefix + '/lib/cache_management/base')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , SystemServiceStatusesModalKlass = require(rootPrefix + '/app/models/system_service_statuses')
  , systemServiceStatusesConst = require(rootPrefix + '/lib/global_constant/system_service_statuses')
  , systemServiceStatusesModal = new SystemServiceStatusesModalKlass()
;

/**
 * @constructor
 * @augments SystemServiceStatusesCacheKlass
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const SystemServiceStatusesCacheKlass = module.exports = function(params) {

  const oThis = this;

  baseCache.call(this, params);

};

SystemServiceStatusesCacheKlass.prototype = Object.create(baseCache.prototype);

SystemServiceStatusesCacheKlass.prototype.constructor = SystemServiceStatusesCacheKlass;

/**
 * set cache key
 *
 * @return {String}
 */
SystemServiceStatusesCacheKlass.prototype.setCacheKey = function() {

  const oThis = this;

  oThis.cacheKey = oThis._sharedCacheKeyPrefix() + "c_sys_ss";

  return oThis.cacheKey;

};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
SystemServiceStatusesCacheKlass.prototype.setCacheExpiry = function() {

  const oThis = this;

  oThis.cacheExpiry = 24*60*60 // 24 hours ;

  return oThis.cacheExpiry;

};

/**
  * fetch data from source
  *
  * @return {Result}
  */
SystemServiceStatusesCacheKlass.prototype.fetchDataFromSource = async function() {

  const oThis = this;

  const response = await systemServiceStatusesModal.getAll()
    , formattedRsp = {saas_api_available: 1};

  if (response[0]) {
    for(var i=0; i<response.length; i++) {
      var nameInt = response[i].name.toString()
          , statusInt = response[i].status.toString();
      if (nameInt == systemServiceStatusesModal.enums.name.inverted[systemServiceStatusesConst.saasApiName]) {
        if (statusInt == systemServiceStatusesModal.enums.status.inverted[systemServiceStatusesConst.downStatus]) {
          formattedRsp['saas_api_available'] = 0;
        }
      }
    }
  }

  return responseHelper.successWithData(formattedRsp);

};