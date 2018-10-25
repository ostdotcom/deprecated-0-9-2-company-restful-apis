'use strict';

const rootPrefix = '..',
  packageFile = require(rootPrefix + '/package.json');

function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}

// SaaS only cache engine
// NOTE: Should always be memcached
// Other required connection variables will still be read from cache flavour related variables
if (process.env.CR_ONLY_SHARED_CACHE_ENGINE !== 'memcached') {
  throw 'SAAS need CR_ONLY_SHARED_CACHE_ENGINE = "memcached" ENV variable for custom caching';
}
define('SAAS_ONLY_SHARED_CACHE_ENGINE', process.env.CR_ONLY_SHARED_CACHE_ENGINE);
define('SHARED_MEMCACHE_SERVERS', process.env.OST_SHARED_MEMCACHE_SERVERS);

// package variables for current repo
define('PACKAGE_NAME', packageFile.name);
define('PACKAGE_VERSION', packageFile.version);

// Core details
define('ENVIRONMENT', process.env.CR_ENVIRONMENT);
define('SUB_ENVIRONMENT', process.env.CR_SUB_ENVIRONMENT);
define('ENVIRONMENT_SHORT', process.env.CR_ENVIRONMENT.substring(0, 2));
define('SUB_ENVIRONMENT_SHORT', process.env.CR_SUB_ENVIRONMENT.substring(0, 2));

// Gas prices
define('OST_UTILITY_GAS_PRICE', process.env.OST_UTILITY_GAS_PRICE);
define('OST_VALUE_GAS_PRICE', process.env.OST_VALUE_GAS_PRICE);

// Redis details
define('OST_REDIS_HOST', process.env.OST_REDIS_HOST);
define('OST_REDIS_PORT', process.env.OST_REDIS_PORT);
define('OST_REDIS_PASS', process.env.OST_REDIS_PASS);
define('OST_REDIS_TLS_ENABLED', process.env.OST_REDIS_TLS_ENABLED);

// MySQL details
define('MYSQL_CONNECTION_POOL_SIZE', process.env.CR_MYSQL_CONNECTION_POOL_SIZE);

define('DEFAULT_MYSQL_HOST', process.env.CR_DEFAULT_MYSQL_HOST);
define('DEFAULT_MYSQL_USER', process.env.CR_DEFAULT_MYSQL_USER);
define('DEFAULT_MYSQL_PASSWORD', process.env.CR_DEFAULT_MYSQL_PASSWORD);

// SaaS Economy DB Credentials
define('CR_ECONOMY_DB_MYSQL_HOST', process.env.CR_ECONOMY_DB_MYSQL_HOST);
define('CR_ECONOMY_DB_MYSQL_USER', process.env.CR_ECONOMY_DB_MYSQL_USER);
define('CR_ECONOMY_DB_MYSQL_PASSWORD', process.env.CR_ECONOMY_DB_MYSQL_PASSWORD);

// SaaS RabbitMQ credentials
define('OST_RMQ_HOST', process.env.OST_RMQ_HOST);
define('OST_RMQ_PORT', process.env.OST_RMQ_PORT);
define('OST_RMQ_USERNAME', process.env.OST_RMQ_USERNAME);
define('OST_RMQ_PASSWORD', process.env.OST_RMQ_PASSWORD);
define('OST_RMQ_HEARTBEATS', process.env.OST_RMQ_HEARTBEATS);
define('OST_RMQ_SUPPORT', process.env.OST_RMQ_SUPPORT);

// SaaS Transaction DB Credentials
define('CR_TRANSACTION_DB_MYSQL_HOST', process.env.CR_TRANSACTION_DB_MYSQL_HOST);
define('CR_TRANSACTION_DB_MYSQL_USER', process.env.CR_TRANSACTION_DB_MYSQL_USER);
define('CR_TRANSACTION_DB_MYSQL_PASSWORD', process.env.CR_TRANSACTION_DB_MYSQL_PASSWORD);

define('CA_SHARED_MYSQL_HOST', process.env.CR_CA_SHARED_MYSQL_HOST);
define('CA_SHARED_MYSQL_USER', process.env.CR_CA_SHARED_MYSQL_USER);
define('CA_SHARED_MYSQL_PASSWORD', process.env.CR_CA_SHARED_MYSQL_PASSWORD);

// AWS details
define('AWS_ACCESS_KEY', process.env.CR_AWS_ACCESS_KEY);
define('AWS_SECRET_KEY', process.env.CR_AWS_SECRET_KEY);
define('AWS_REGION', process.env.CR_AWS_REGION);

// KMS details
define('KMS_API_KEY_ARN', process.env.CR_API_KEY_KMS_ARN);
define('KMS_API_KEY_ID', process.env.CR_API_KEY_KMS_ID);
define('KMS_MANAGED_ADDR_KEY_ARN', process.env.CR_MANAGED_ADDRESS_KMS_ARN);
define('KMS_MANAGED_ADDR_KEY_ID', process.env.CR_MANAGED_ADDRESS_KMS_ID);

// JWT details
define('SAAS_API_SECRET_KEY', process.env.CA_SAAS_API_SECRET_KEY);

// SHA256 details
define('GENERIC_SHA_KEY', process.env.CA_GENERIC_SHA_KEY);

// Cache data key
define('CACHE_SHA_KEY', process.env.CR_CACHE_DATA_SHA_KEY);

define('DEBUG_ENABLED', process.env.OST_DEBUG_ENABLED);

// Price oracle details
let accepted_margin = {};
try {
  accepted_margin = JSON.parse(process.env.CR_ACCEPTED_PRICE_FLUCTUATION_FOR_PAYMENT);
} catch (err) {}
define('ACCEPTED_PRICE_FLUCTUATION_FOR_PAYMENT', accepted_margin);

define('SHARED_MEMCACHE_KEY_PREFIX', 'ca_sa_shared_');

define('CONFIG_STRATEGY_SALT', 'config_strategy_salt');

define('OST_WEB3_POOL_SIZE', process.env.OST_WEB3_POOL_SIZE);

// Map of all addresses which would be needed to unlocked via Key Store File.
// Every other address will be unlocked via private_key.
const addresses_to_unlock_via_keystore_file = ['OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR'];

let addresses_to_unlock_via_keystore_file_map = {};
for (let i = 0; i < addresses_to_unlock_via_keystore_file.length; i++) {
  let addr = process.env[addresses_to_unlock_via_keystore_file[i]];
  if (addr) {
    addresses_to_unlock_via_keystore_file_map[addr.toLowerCase()] = 1;
  }
}

define('ADDRESSES_TO_UNLOCK_VIA_KEYSTORE_FILE_MAP', addresses_to_unlock_via_keystore_file_map);

define('ENV_IDENTIFIER', process.env.ENV_IDENTIFIER ? process.env.ENV_IDENTIFIER : '');

//Gas price for mainnet
define('MIN_VALUE_GAS_PRICE', process.env.MIN_VALUE_GAS_PRICE);
define('MAX_VALUE_GAS_PRICE', process.env.MAX_VALUE_GAS_PRICE);
define('DEFAULT_VALUE_GAS_PRICE', process.env.DEFAULT_VALUE_GAS_PRICE);
define('BUFFER_VALUE_GAS_PRICE', process.env.BUFFER_VALUE_GAS_PRICE);
