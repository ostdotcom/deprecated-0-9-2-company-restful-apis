'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/shared_cache_management/base'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  SystemServiceStatusesModal = require(rootPrefix + '/app/models/system_service_statuses'),
  systemServiceStatusesConst = require(rootPrefix + '/lib/global_constant/system_service_statuses'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management');

/**
 * @constructor
 * @augments System Service Statuses Cache Klass
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const SystemServiceStatusesCacheKlass = function(params) {
  const oThis = this;
  oThis.cacheType = cacheManagementConst.shared_memcached;
  oThis.consistentBehavior = '1';

  baseCache.call(this, params);
};

SystemServiceStatusesCacheKlass.prototype = Object.create(baseCache.prototype);

const SystemServiceStatusesCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._sharedCacheKeyPrefix() + 'c_sys_ss';

    return oThis.cacheKey;
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    const oThis = this;

    oThis.cacheExpiry = 24 * 60 * 60; // 24 hours ;

    return oThis.cacheExpiry;
  },

  /**
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {
    const oThis = this;

    const response = await new SystemServiceStatusesModal().select('*').fire(),
      formattedRsp = { saas_api_available: 1 };

    if (response[0]) {
      for (let i = 0; i < response.length; i++) {
        let nameInt = response[i].name.toString(),
          statusInt = response[i].status.toString();
        if (nameInt == new SystemServiceStatusesModal().enums.name.inverted[systemServiceStatusesConst.saasApiName]) {
          if (
            statusInt == new SystemServiceStatusesModal().enums.status.inverted[systemServiceStatusesConst.downStatus]
          ) {
            formattedRsp['saas_api_available'] = 0;
          }
        }
      }
    }

    return Promise.resolve(responseHelper.successWithData(formattedRsp));
  }
};

Object.assign(SystemServiceStatusesCacheKlass.prototype, SystemServiceStatusesCacheKlassPrototype);

module.exports = SystemServiceStatusesCacheKlass;
