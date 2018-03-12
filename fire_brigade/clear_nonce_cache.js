openStCache = require('@openstfoundation/openst-cache')
;

const rootPrefix = '..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

const ClearNonceCache = function(params) {
  const oThis = this
  ;

  oThis.address = params.address.toLowerCase();
  oThis.chainKind = params.chain_kind;
};

ClearNonceCache.prototype = {
  perform: async function() {
    const oThis = this
    ;

    const nonceCacheKey = `nonce_${oThis.chainKind}_${oThis.address}`
      , nonceLockCacheKey = `nonce_${oThis.chainKind}_${oThis.address}_lock`
      , cacheImplementer = new openStCache.cache(coreConstants.BALANCE_AND_NONCE_ONLY_CACHE_ENGINE, false)
    ;

    await cacheImplementer.del(nonceCacheKey);
    await cacheImplementer.del(nonceLockCacheKey);

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

module.exports = ClearNonceCache;