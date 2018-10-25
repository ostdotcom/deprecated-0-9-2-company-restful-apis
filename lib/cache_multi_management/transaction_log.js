'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_multi_management/base'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/app/models/transaction_log');

/**
 * @constructor
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 */
const TransactionLogCacheKlass = function(params) {
  const oThis = this;

  oThis.uuids = params['uuids'];
  oThis.clientId = params['client_id'];
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '1';

  baseCache.call(oThis, params);

  oThis.useObject = true;
};

TransactionLogCacheKlass.prototype = Object.create(baseCache.prototype);

const TransactionLogCacheKlassPrototype = {
  /**
   * set cache key
   *
   * @return {Object}
   */
  setCacheKeys: function() {
    const oThis = this;

    oThis.cacheKeys = {};
    for (let i = 0; i < oThis.uuids.length; i++) {
      oThis.cacheKeys[oThis._generateCacheKey(oThis.uuids[i])] = oThis.uuids[i].toLowerCase();
    }

    return oThis.cacheKeys;
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    const oThis = this;

    oThis.cacheExpiry = 1800; // 30 min

    return oThis.cacheExpiry;
  },

  /**
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function(cacheMissTxUuids) {
    const oThis = this,
      transactionLogModel = oThis.ic().getTransactionLogModel();

    if (!cacheMissTxUuids) {
      return responseHelper.error({
        internal_error_identifier: 'cmm_tl_1',
        api_error_identifier: 'blank_uuids',
        error_config: errorConfig
      });
    }

    let transactionFetchResponse = await new transactionLogModel({
      client_id: oThis.clientId,
      shard_name: oThis.ic().configStrategy.TRANSACTION_LOG_SHARD_NAME
    }).batchGetItem(cacheMissTxUuids);

    return Promise.resolve(transactionFetchResponse);
  },

  /**
   * set data in cache.
   *
   * @param {Object} dataToSet - indexed by TxUUid, data to set in cache for each uuid
   *
   * @return {Promise}
   */
  setCache: async function(dataToSet) {
    const oThis = this;

    let promises = [],
      uuid;

    for (let i = 0; i < oThis.uuids.length; i++) {
      uuid = oThis.uuids[i];
      promises.push(oThis._setCache(uuid, dataToSet[uuid]));
    }

    return new Promise(async function(onResolve) {
      let promiseResponses = await Promise.all(promises);
      onResolve(promiseResponses);
    });
  },

  /**
   * generate cache key.
   *
   * @param {String} uuid - tx uuid
   *
   * @return {String}
   */
  _generateCacheKey: function(uuid) {
    const oThis = this;

    return `${oThis._cacheKeyPrefix()}cma_tl_cid_${oThis.clientId}_uid_${uuid.toLowerCase()}`;
  }
};

Object.assign(TransactionLogCacheKlass.prototype, TransactionLogCacheKlassPrototype);

InstanceComposer.registerShadowableClass(TransactionLogCacheKlass, 'getTransactionLogCache');

module.exports = TransactionLogCacheKlass;
