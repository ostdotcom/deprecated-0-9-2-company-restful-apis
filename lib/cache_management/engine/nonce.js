'use strict';

const openStCache = require('@openstfoundation/openst-cache');

const rootPrefix = '../../..',
  coreConstants = require(rootPrefix + '/config/core_constants');

module.exports = openStCache.getInstance({
  OST_CACHING_ENGINE: coreConstants.NONCE_ONLY_CACHE_ENGINE,
  OST_CACHE_CONSISTENT_BEHAVIOR: 1
});
