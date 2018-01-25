"use strict";

function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}

define("ENVIRONMENT", process.env.CR_ENVIRONMENT);
define("SUB_ENV", process.env.CR_SUB_ENV);
define("NO_OF_POOLS", process.env.CR_NO_OF_POOLS);
define("TIMEZONE", process.env.CR_TIMEZONE);
define("MYSQL_HOST", process.env.CR_MYSQL_HOST);
define("MYSQL_USER", process.env.CR_MYSQL_USER);
define("MYSQL_PASSWORD", process.env.CR_MYSQL_PASSWORD);
define("AWS_ACCESS_KEY", process.env.CR_AWS_ACCESS_KEY);
define("AWS_SECRET_KEY", process.env.CR_AWS_SECRET_KEY);
define("AWS_REGION", process.env.CR_AWS_REGION);
define("KMS_INFO_ARN", process.env.CR_INFO_KMS_ARN);
define("KMS_INFO_ID", process.env.CR_INFO_KMS_ID);
define('SAAS_API_SECRET_KEY', process.env.CA_SAAS_API_SECRET_KEY);