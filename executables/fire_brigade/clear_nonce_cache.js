/**
 * Script to clear nonce cache
 *
 * @module executables/fire_brigade/clear_nonce_cache
 */

const rootPrefix = '../..',
  OpenStCache = require('@openstfoundation/openst-cache'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  configStrategyHelper = require(rootPrefix + '/helpers/config_strategy/by_client_id'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  SharedRedisProvider = require(rootPrefix + '/lib/providers/shared_redis'),
  fetchPrivateKeyKlass = require(rootPrefix + '/lib/shared_cache_management/address_private_key');

/**
 * parameters
 *
 * @param {object} params - external passed parameters
 * @param {String} params.address - address
 * @param {String} params.chain_kind - chain_kind (value | utilty)
 * @param {Integer} params.chain_id - chain_id
 *
 *
 */

const ClearNonceCache = function(params) {
  const oThis = this;

  oThis.address = params.address.toLowerCase();
  oThis.chainKind = params.chain_kind;
  oThis.chainId = params.chain_id;
  oThis.consistentBehavior = '0';
};

ClearNonceCache.prototype = {
  perform: async function() {
    const oThis = this;
    let cacheObject = {};

    const fetchPrivateKeyObj = new fetchPrivateKeyKlass({ address: oThis.address }),
      fetchPrivateKeyRsp = await fetchPrivateKeyObj.fetchDecryptedData(),
      clientId = fetchPrivateKeyRsp.data['client_id'];

    if (clientId === '0') {
      cacheObject = SharedRedisProvider.getInstance(oThis.consistentBehavior);
    } else {
      let configStrategyHelperObj = new configStrategyHelper(clientId);

      let configStrategyResponse = await configStrategyHelperObj.get();
      if (configStrategyResponse.isFailure()) {
        return Promise.reject(configStrategyResponse);
      }

      let configStrategy = configStrategyResponse.data;

      let cacheConfigStrategy = {
        OST_CACHING_ENGINE: cacheManagementConst.redis,
        OST_REDIS_HOST: configStrategy.OST_REDIS_HOST,
        OST_REDIS_PORT: configStrategy.OST_REDIS_PORT,
        OST_REDIS_PASS: configStrategy.OST_REDIS_PASS,
        OST_REDIS_TLS_ENABLED: configStrategy.OST_REDIS_TLS_ENABLED,
        OST_DEFAULT_TTL: configStrategy.OST_DEFAULT_TTL,
        OST_CACHE_CONSISTENT_BEHAVIOR: '0'
      };

      cacheObject = OpenStCache.getInstance(cacheConfigStrategy);
    }

    const nonceCacheKey = `nonce_${oThis.chainKind}_${oThis.address}_${oThis.chainId}`,
      nonceLockCacheKey = `nonce_${oThis.chainKind}_${oThis.address}_${oThis.chainId}_lock`,
      // Set cacheImplementer to perform caching operations.
      cacheImplementer = cacheObject.cacheInstance;

    await cacheImplementer.del(nonceCacheKey);
    await cacheImplementer.del(nonceLockCacheKey);

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

module.exports = ClearNonceCache;
