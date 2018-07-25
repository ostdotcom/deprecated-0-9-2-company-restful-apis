'use strict';

const openStCache = require('@openstfoundation/openst-cache');

const rootPrefix = '../../..',
  coreConstants = require(rootPrefix + '/config/core_constants');

module.exports = new openStCache.cache(coreConstants.SAAS_ONLY_CACHE_ENGINE, true);
