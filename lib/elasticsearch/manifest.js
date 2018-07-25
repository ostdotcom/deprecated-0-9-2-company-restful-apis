'use strict';
/**
 * Manifest of elasticsearch core services.
 *
 * @module elasticsearch/services/es_services/manifest
 */

const rootPrefix = '.',
  transactionLogService = require(rootPrefix + '/services/transaction_log/service');

module.exports = {
  services: {
    transactionLog: transactionLogService
  }
};
