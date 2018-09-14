'use strict';

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  maxTransactionsThreshold = 1000000000000000,
  cacheExpiry = 86400;

/**
 * @constructor
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ClientTransactionsRateLimitCacheKlass = function(params) {
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '1';

  baseCache.call(oThis, params);
  oThis.useObject = false;
};

ClientTransactionsRateLimitCacheKlass.prototype = Object.create(baseCache.prototype);

const ClientTransactionsRateLimitCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'c_tr_rl_' + oThis.clientId;

    return oThis.cacheKey;
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    const oThis = this;

    oThis.cacheExpiry = cacheExpiry;

    return oThis.cacheExpiry;
  },

  /**
   * Increment Transaction Count for a client.
   *
   * @return {Promise<any>}
   */
  _incrementTransactionCount: async function() {
    const oThis = this;

    var resp = await oThis.cacheImplementer.increment(oThis.cacheKey, 1),
      count = 0;

    if (resp.isFailure()) {
      oThis._setCache(1);
      count = 1;
    } else {
      count = resp.data.response;
    }

    return Promise.resolve(responseHelper.successWithData({ trxCount: count }));
  },

  transactionRateLimitCrossed: async function() {
    const oThis = this;

    var result = await oThis._incrementTransactionCount();

    if (result.isFailure()) {
      return Promise.resolve(result);
    }

    var lc = result.data.trxCount > maxTransactionsThreshold;
    return Promise.resolve(responseHelper.successWithData({ limitCrossed: lc, rateLimitCount: result.data.trxCount }));
  }
};

Object.assign(ClientTransactionsRateLimitCacheKlass.prototype, ClientTransactionsRateLimitCacheKlassPrototype);

InstanceComposer.registerShadowableClass(
  ClientTransactionsRateLimitCacheKlass,
  'getClientTransactionsRateLimitCacheClass'
);

module.exports = ClientTransactionsRateLimitCacheKlass;
