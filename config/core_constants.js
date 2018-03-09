"use strict";

const rootPrefix = '..'
  , packageFile = require(rootPrefix + '/package.json')
;

function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}

// Balance and Cache only cache engine.
// NOTE: Should always be redis
// Other required connection variables will still be read from cache flavour related variables
if (process.env.OST_CACHE_ENGINE!='redis') {
  throw 'SAAS and other packages need OST_CACHE_ENGINE = "redis" ENV variable for Balance and Nonce management'
}
define("BALANCE_AND_NONCE_ONLY_CACHE_ENGINE", process.env.OST_CACHE_ENGINE);

// Saas only cache engine
// NOTE: Should always be memcached
// Other required connection variables will still be read from cache flavour related variables
if (process.env.CR_ONLY_CACHE_ENGINE!='memcached') {
  throw 'SAAS need CR_ONLY_CACHE_ENGINE = "memcached" ENV variable for custom caching'
}
define("SAAS_ONLY_CACHE_ENGINE", process.env.CR_ONLY_CACHE_ENGINE);

// package variables for current repo
define("PACKAGE_NAME", packageFile.name);
define("PACKAGE_VERSION", packageFile.version);

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
define("KMS_MANAGED_ADDR_KEY_ARN", process.env.CR_MANAGED_ADDRESS_KMS_ARN);
define("KMS_MANAGED_ADDR_KEY_ID", process.env.CR_MANAGED_ADDRESS_KMS_ID);

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