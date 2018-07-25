'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 */
const ClientTxKindCntCacheKlass = function(params) {
  const oThis = this;

  oThis.clientId = params['clientId'];
  baseCache.call(oThis, params);
  oThis.useObject = false;
};

ClientTxKindCntCacheKlass.prototype = Object.create(baseCache.prototype);

const ClientTxKindCntCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'c_tx_t_cnt_' + oThis.clientId;

    return oThis.cacheKey;
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    const oThis = this;

    oThis.cacheExpiry = 86400; // 24 hours

    return oThis.cacheExpiry;
  },
  /**
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {
    const oThis = this,
      result = await new ClientTransactionTypeModel().getCount({ clientId: oThis.clientId }),
      count = result[0].cnt;

    //NOTE: storing str in it as of now. As facing problems with setting int 0 as cache value
    return Promise.resolve(responseHelper.successWithData(count));
  }
};

Object.assign(ClientTxKindCntCacheKlass.prototype, ClientTxKindCntCacheKlassPrototype);

module.exports = ClientTxKindCntCacheKlass;
