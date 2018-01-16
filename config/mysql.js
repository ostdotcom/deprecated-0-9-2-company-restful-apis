"use strict";

const rootPrefix = '..'
  , coreConstants = require(rootPrefix + '/config/core_constants');

const mysqlConfig = {
  "commonNodeConfig": {
    "connectionLimit": coreConstants.NO_OF_POOLS,
    "charset": "UTF8_UNICODE_CI",
    "timezone": coreConstants.TIMEZONE,
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
mysqlConfig["databases"]["company_client_"+coreConstants.ENVIRONMENT] = ["cluster1"];
mysqlConfig["databases"]["company_client_economy_"+coreConstants.SUB_ENV+"_"+coreConstants.ENVIRONMENT] = ["cluster1"];

module.exports = mysqlConfig;