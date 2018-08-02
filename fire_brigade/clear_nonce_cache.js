const rootPrefix = '..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  cacheImplementer = require(rootPrefix + '/lib/cache_management/engine/nonce');

const ClearNonceCache = function(params) {
  const oThis = this;

  oThis.address = params.address.toLowerCase();
  oThis.chainKind = params.chain_kind;
};

ClearNonceCache.prototype = {
  perform: async function() {
    const oThis = this;

    const nonceCacheKey = `nonce_${oThis.chainKind}_${oThis.address}`,
      nonceLockCacheKey = `nonce_${oThis.chainKind}_${oThis.address}_lock`;

    await cacheImplementer.del(nonceCacheKey);
    await cacheImplementer.del(nonceLockCacheKey);

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

module.exports = ClearNonceCache;
