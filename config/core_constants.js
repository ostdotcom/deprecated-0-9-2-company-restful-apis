"use strict";

function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}

// Core details
define("ENVIRONMENT", process.env.CR_ENVIRONMENT);
define("SUB_ENVIRONMENT", process.env.CR_SUB_ENVIRONMENT);
define("ENVIRONMENT_SHORT", process.env.CR_ENVIRONMENT.substring(0,2));
define("SUB_ENVIRONMENT_SHORT", process.env.CR_SUB_ENVIRONMENT.substring(0,2));

// MySQL details

define("MYSQL_CONNECTION_POOL_SIZE", process.env.CR_MYSQL_CONNECTION_POOL_SIZE);

define("DEFAULT_MYSQL_HOST", process.env.CR_DEFAULT_MYSQL_HOST);
define("DEFAULT_MYSQL_USER", process.env.CR_DEFAULT_MYSQL_USER);
define("DEFAULT_MYSQL_PASSWORD", process.env.CR_DEFAULT_MYSQL_PASSWORD);

define("CA_SHARED_MYSQL_HOST", process.env.CR_CA_SHARED_MYSQL_HOST);
define("CA_SHARED_MYSQL_USER", process.env.CR_CA_SHARED_MYSQL_USER);
define("CA_SHARED_MYSQL_PASSWORD", process.env.CR_CA_SHARED_MYSQL_PASSWORD);

// AWS details
define("AWS_ACCESS_KEY", process.env.CR_AWS_ACCESS_KEY);
define("AWS_SECRET_KEY", process.env.CR_AWS_SECRET_KEY);
define("AWS_REGION", process.env.CR_AWS_REGION);

// KMS details
define("KMS_API_KEY_ARN", process.env.CR_API_KEY_KMS_ARN);
define("KMS_API_KEY_ID", process.env.CR_API_KEY_KMS_ID);

// JWT details
define('SAAS_API_SECRET_KEY', process.env.CA_SAAS_API_SECRET_KEY);

// SHA256 details
define('GENERIC_SHA_KEY', process.env.CA_GENERIC_SHA_KEY);

// Cache data key
define('CACHE_SHA_KEY', process.env.CR_CACHE_DATA_SHA_KEY);

// Price oracle details
var accepted_margine = {};
try {
  accepted_margine = JSON.parse(process.env.CR_ACCEPTED_PRICE_FLUCTUATION_FOR_PAYMENT);
} catch(err) {
}
define('ACCEPTED_PRICE_FLUCTUATION_FOR_PAYMENT', accepted_margine);