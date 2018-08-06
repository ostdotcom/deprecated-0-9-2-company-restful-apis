'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  OstPlatform = require('@openstfoundation/openst-platform'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * @constructor
 * @augments OST Balance Cache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const OstBalanceCacheKlass = function(params) {
  const oThis = this;

  oThis.address = params['address'];
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '1';

  baseCache.call(oThis, params);
};

OstBalanceCacheKlass.prototype = Object.create(baseCache.prototype);

const OstBalanceCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'bal_ost_' + oThis.address;

    return oThis.cacheKey;
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    const oThis = this;

    oThis.cacheExpiry = 60; // 1 minute ;

    return oThis.cacheExpiry;
  },

  /**
   * fetch data from source and return OST balance from VC in Wei
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {
    const oThis = this,
      openStPlatform = new OstPlatform(oThis.ic().configStrategy);

    const obj = new openStPlatform.services.balance.simpleToken({ address: oThis.address });

    const response = await obj.perform();

    if (response.isFailure()) {
      return Promise.resolve(response);
    } else {
      return Promise.resolve(responseHelper.successWithData(response.data['balance']));
    }
  }
};

Object.assign(OstBalanceCacheKlass.prototype, OstBalanceCacheKlassPrototype);

InstanceComposer.registerShadowableClass(OstBalanceCacheKlass, 'getOstBalanceCache');

module.exports = OstBalanceCacheKlass;
