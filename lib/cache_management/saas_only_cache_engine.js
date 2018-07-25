'use strict';

const rootPrefix = '../..',
  openStCache = require('@openstfoundation/openst-cache'),
  coreConstants = require(rootPrefix + '/config/core_constants');

module.exports = new openStCache.cache(coreConstants.SAAS_ONLY_CACHE_ENGINE, true);
