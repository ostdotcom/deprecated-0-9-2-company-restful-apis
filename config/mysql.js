"use strict";

const rootPrefix = '..'
  , coreConstants = require(rootPrefix + '/config/core_constants');

const mysqlConfig = {
  "commonNodeConfig": {
    "connectionLimit": coreConstants.MYSQL_CONNECTION_POOL_SIZE,
    "charset": "UTF8_UNICODE_CI",
    "bigNumberStrings": true,
    "supportBigNumbers": true,
    "dateStrings": true,
    "debug": false
  },
  "commonClusterConfig": {
    "canRetry": true,
    "removeNodeErrorCount": 5,
    "restoreNodeTimeout": 10000,
    "defaultSelector": "RR"
  },
  "clusters": {
    "cluster1": {
      "master": {
        "host": coreConstants.MYSQL_HOST,
        "user": coreConstants.MYSQL_USER,
        "password": coreConstants.MYSQL_PASSWORD
      }
    }
  },
  "databases":{

  }
};
mysqlConfig["databases"]["saas_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT] = ["cluster1"];
mysqlConfig["databases"]["saas_transaction_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT] = ["cluster1"];
mysqlConfig["databases"]["company_saas_shared_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT] = ["cluster1"];
mysqlConfig["databases"]["saas_airdrop_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT] = ["cluster1"];

module.exports = mysqlConfig;