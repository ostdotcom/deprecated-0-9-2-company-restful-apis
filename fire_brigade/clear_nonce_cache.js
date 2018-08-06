const rootPrefix = '..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  SharedRedisProvider = require(rootPrefix + '/lib/providers/shared_redis');

const ClearNonceCache = function(params) {
  const oThis = this;

  oThis.address = params.address.toLowerCase();
  oThis.chainKind = params.chain_kind;
  oThis.consistentBehavior = '1';
};

ClearNonceCache.prototype = {
  perform: async function() {
    const oThis = this;

    const nonceCacheKey = `nonce_${oThis.chainKind}_${oThis.address}`,
      nonceLockCacheKey = `nonce_${oThis.chainKind}_${oThis.address}_lock`,
      cacheObject = SharedRedisProvider.getInstance(oThis.consistentBehavior);

    // Set cacheImplementer to perform caching operations.
    const cacheImplementer = cacheObject.cacheInstance;

    await cacheImplementer.del(nonceCacheKey);
    await cacheImplementer.del(nonceLockCacheKey);

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

module.exports = ClearNonceCache;
