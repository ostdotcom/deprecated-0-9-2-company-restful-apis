"use strict";
/**
 * Manifest of elasticsearch core services.
 *
 * @module elasticsearch/services/es_services/manifest
 */

const rootPrefix      = "../.."
    , logger          = require(rootPrefix + "/providers/logger")
    , createService   = require(rootPrefix + "/services/es_services/create")
    , updateService   = require(rootPrefix + "/services/es_services/update")
    , deleteService   = require(rootPrefix + "/services/es_services/delete")
    , bulkService     = require(rootPrefix + "/services/es_services/bulk")
    , searchService   = require(rootPrefix + "/services/es_services/search")
;

module.exports = {
  createService    : createService
  , updateService  : updateService
  , deleteService  : deleteService
  , bulkService    : bulkService
  , searchService  : searchService
};
