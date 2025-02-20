'use strict';

const rootPrefix = '..',
  coreConstants = require(rootPrefix + '/config/core_constants');

const mysqlConfig = {
  commonNodeConfig: {
    connectionLimit: coreConstants.MYSQL_CONNECTION_POOL_SIZE,
    charset: 'UTF8_UNICODE_CI',
    bigNumberStrings: true,
    supportBigNumbers: true,
    dateStrings: true,
    debug: false
  },
  commonClusterConfig: {
    canRetry: true,
    removeNodeErrorCount: 5,
    restoreNodeTimeout: 10000,
    defaultSelector: 'RR'
  },
  clusters: {
    cluster1: {
      master: {
        host: coreConstants.DEFAULT_MYSQL_HOST,
        user: coreConstants.DEFAULT_MYSQL_USER,
        password: coreConstants.DEFAULT_MYSQL_PASSWORD
      }
    },
    cluster2: {
      master: {
        host: coreConstants.CA_SHARED_MYSQL_HOST,
        user: coreConstants.CA_SHARED_MYSQL_USER,
        password: coreConstants.CA_SHARED_MYSQL_PASSWORD
      }
    },
    cluster3: {
      master: {
        host: coreConstants.CR_ECONOMY_DB_MYSQL_HOST,
        user: coreConstants.CR_ECONOMY_DB_MYSQL_USER,
        password: coreConstants.CR_ECONOMY_DB_MYSQL_PASSWORD
      }
    },
    cluster4: {
      master: {
        host: coreConstants.CR_TRANSACTION_DB_MYSQL_HOST,
        user: coreConstants.CR_TRANSACTION_DB_MYSQL_USER,
        password: coreConstants.CR_TRANSACTION_DB_MYSQL_PASSWORD
      }
    },
    cluster5: {
      master: {
        host: coreConstants.CR_SAAS_ANALYTICS_DB_HOST,
        user: coreConstants.CR_SAAS_ANALYTICS_DB_USER,
        password: coreConstants.CR_SAAS_ANALYTICS_DB_PASSWORD
      }
    }
  },
  databases: {}
};

mysqlConfig['databases']['saas_airdrop_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT] = [
  'cluster1'
];

mysqlConfig['databases']['saas_big_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT] = ['cluster1'];

mysqlConfig['databases']['saas_client_economy_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT] = [
  'cluster3'
];

mysqlConfig['databases']['saas_transaction_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT] = [
  'cluster4'
];

mysqlConfig['databases']['company_saas_shared_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT] = [
  'cluster2'
];

mysqlConfig['databases']['saas_config_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT] = [
  'cluster3'
];

mysqlConfig['databases']['saas_analytics_' + coreConstants.ENVIRONMENT] = ['cluster5'];

module.exports = mysqlConfig;
