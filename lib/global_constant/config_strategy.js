'use strict';

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util');

const configStrategy = {
  dynamo: 'dynamo',

  dax: 'dax',

  redis: 'redis',

  memcached: 'memcached',

  in_memory: 'in_memory',

  value_geth: 'value_geth',

  value_constants: 'value_constants',

  utility_geth: 'utility_geth',

  utility_constants: 'utility_constants',

  autoscaling: 'autoscaling',

  es: 'es',

  constants: 'constants'
};

const kinds = {
  '1': configStrategy.dynamo,
  '2': configStrategy.dax,
  '3': configStrategy.redis,
  '4': configStrategy.memcached,
  '5': configStrategy.in_memory,
  '6': configStrategy.value_geth,
  '7': configStrategy.value_constants,
  '8': configStrategy.utility_geth,
  '9': configStrategy.utility_constants,
  '10': configStrategy.autoscaling,
  '11': configStrategy.es,
  '12': configStrategy.constants
};

const keysToBeKeptUnencrypted = {
  dynamo: [
    'OS_DYNAMODB_ACCESS_KEY_ID',
    'OS_DYNAMODB_SSL_ENABLED',
    'OS_DYNAMODB_ENDPOINT',
    'OS_DYNAMODB_API_VERSION',
    'OS_DYNAMODB_REGION',
    'OS_DYNAMODB_LOGGING_ENABLED',
    'OS_DYNAMODB_TABLE_NAME_PREFIX',
    'OS_DAX_ENABLED',
    'OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY',
    'OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY'
  ],
  dax: ['OS_DAX_API_VERSION', 'OS_DAX_ACCESS_KEY_ID', 'OS_DAX_REGION', 'OS_DAX_ENDPOINT', 'OS_DAX_SSL_ENABLED'],
  redis: ['OST_REDIS_HOST', 'OST_REDIS_PORT', 'OST_REDIS_TLS_ENABLED'],
  memcached: ['OST_MEMCACHE_SERVERS'],
  in_memory: ['OST_INMEMORY_CACHE_NAMESPACE'],
  value_geth: [
    'OST_VALUE_GETH_RPC_PROVIDER',
    'OST_VALUE_GETH_RPC_PROVIDERS',
    'OST_VALUE_GETH_WS_PROVIDER',
    'OST_VALUE_GETH_WS_PROVIDERS',
    'OST_VALUE_CHAIN_ID'
  ],
  value_constants: [
    'OST_VALUE_GAS_PRICE',
    'OST_OPENSTVALUE_CONTRACT_ADDR',
    'OST_VALUE_REGISTRAR_ADDR',
    'OST_VALUE_DEPLOYER_ADDR',
    'OST_VALUE_OPS_ADDR',
    'OST_VALUE_REGISTRAR_CONTRACT_ADDR',
    'OST_FOUNDATION_ADDR',
    'OST_SIMPLE_TOKEN_CONTRACT_ADDR'
  ],
  utility_geth: [
    'OST_UTILITY_GETH_RPC_PROVIDER',
    'OST_UTILITY_GETH_RPC_PROVIDERS',
    'OST_UTILITY_GETH_WS_PROVIDER',
    'OST_UTILITY_GETH_WS_PROVIDERS',
    'OST_UTILITY_CHAIN_ID'
  ],
  utility_constants: [
    'OST_UTILITY_GAS_PRICE',
    'OST_OPENSTUTILITY_ST_PRIME_UUID',
    'OST_UTILITY_CHAIN_OWNER_ADDR',
    'OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR',
    'OST_UTILITY_REGISTRAR_ADDR',
    'OST_OPENSTUTILITY_CONTRACT_ADDR',
    'OST_UTILITY_REGISTRAR_CONTRACT_ADDR',
    'OST_UTILITY_DEPLOYER_ADDR',
    'OST_UTILITY_OPS_ADDR',
    'OST_STPRIME_CONTRACT_ADDR',
    'OST_UTILITY_PRICE_ORACLES',
    'OST_UTILITY_WORKERS_CONTRACT_ADDRESS',
    'OST_VALUE_CORE_CONTRACT_ADDR'
  ],
  autoscaling: [
    'AUTO_SCALE_DYNAMO',
    'OS_AUTOSCALING_API_VERSION',
    'OS_AUTOSCALING_ACCESS_KEY_ID',
    'OS_AUTOSCALING_REGION',
    'OS_AUTOSCALING_ENDPOINT',
    'OS_AUTOSCALING_SSL_ENABLED',
    'OS_AUTOSCALING_LOGGING_ENABLED'
  ],
  es: ['CR_ES_HOST', 'AWS_ES_ACCESS_KEY', 'AWS_ES_REGION'],
  constants: [
    'OST_STAKER_ADDR',
    'OST_REDEEMER_ADDR',
    'OST_CACHING_ENGINE',
    'OST_DEFAULT_TTL',
    'OST_CACHE_CONSISTENT_BEHAVIOR',
    'OST_STANDALONE_MODE'
  ]
};

const keysToEncrypt = {
  dynamo: ['OS_DYNAMODB_SECRET_ACCESS_KEY'],
  dax: ['OS_DAX_SECRET_ACCESS_KEY'],
  redis: ['OST_REDIS_PASS'],
  memcached: [],
  in_memory: [],
  value_geth: [],
  value_constants: [
    'OST_VALUE_REGISTRAR_PASSPHRASE',
    'OST_VALUE_DEPLOYER_PASSPHRASE',
    'OST_VALUE_OPS_PASSPHRASE',
    'OST_FOUNDATION_PASSPHRASE'
  ],
  utility_geth: [],
  utility_constants: [
    'OST_UTILITY_CHAIN_OWNER_PASSPHRASE',
    'OST_UTILITY_INITIAL_ST_PRIME_HOLDER_PASSPHRASE',
    'OST_UTILITY_REGISTRAR_PASSPHRASE',
    'OST_UTILITY_DEPLOYER_PASSPHRASE',
    'OST_UTILITY_OPS_PASSPHRASE'
  ],
  autoscaling: ['OS_AUTOSCALING_SECRET_ACCESS_KEY'],
  es: ['AWS_ES_SECRET_KEY'],
  constants: ['OST_STAKER_PASSPHRASE', 'OST_REDEEMER_PASSPHRASE']
};

const identifierKeys = {
  dynamo: ['OS_DYNAMODB_ACCESS_KEY_ID', 'OS_DYNAMODB_ENDPOINT', 'OS_DYNAMODB_API_VERSION', 'OS_DYNAMODB_REGION'],
  dax: ['OS_DAX_API_VERSION', 'OS_DAX_ACCESS_KEY_ID', 'OS_DAX_REGION', 'OS_DAX_ENDPOINT'],
  redis: ['OST_REDIS_HOST', 'OST_REDIS_PORT'],
  memcached: ['OST_MEMCACHE_SERVERS'],
  in_memory: ['OST_INMEMORY_CACHE_NAMESPACE'],
  value_geth: [
    'OST_VALUE_GETH_RPC_PROVIDER',
    'OST_VALUE_GETH_RPC_PROVIDERS',
    'OST_VALUE_GETH_WS_PROVIDER',
    'OST_VALUE_GETH_WS_PROVIDERS',
    'OST_VALUE_CHAIN_ID'
  ],
  value_constants: [
    'OST_VALUE_GAS_PRICE',
    'OST_OPENSTVALUE_CONTRACT_ADDR',
    'OST_VALUE_REGISTRAR_ADDR',
    'OST_VALUE_DEPLOYER_ADDR',
    'OST_VALUE_OPS_ADDR',
    'OST_VALUE_REGISTRAR_CONTRACT_ADDR',
    'OST_FOUNDATION_ADDR',
    'OST_SIMPLE_TOKEN_CONTRACT_ADDR'
  ],
  utility_geth: [
    'OST_UTILITY_GETH_RPC_PROVIDER',
    'OST_UTILITY_GETH_RPC_PROVIDERS',
    'OST_UTILITY_GETH_WS_PROVIDER',
    'OST_UTILITY_GETH_WS_PROVIDERS',
    'OST_UTILITY_CHAIN_ID'
  ],
  utility_constants: [
    'OST_OPENSTUTILITY_ST_PRIME_UUID',
    'OST_UTILITY_CHAIN_OWNER_ADDR',
    'OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR',
    'OST_UTILITY_REGISTRAR_ADDR',
    'OST_OPENSTUTILITY_CONTRACT_ADDR',
    'OST_UTILITY_REGISTRAR_CONTRACT_ADDR',
    'OST_UTILITY_DEPLOYER_ADDR',
    'OST_UTILITY_OPS_ADDR',
    'OST_STPRIME_CONTRACT_ADDR',
    'OST_UTILITY_WORKERS_CONTRACT_ADDRESS',
    'OST_VALUE_CORE_CONTRACT_ADDR'
  ],
  autoscaling: [
    'OS_AUTOSCALING_API_VERSION',
    'OS_AUTOSCALING_ACCESS_KEY_ID',
    'OS_AUTOSCALING_REGION',
    'OS_AUTOSCALING_ENDPOINT'
  ],
  es: ['CR_ES_HOST', 'AWS_ES_ACCESS_KEY', 'AWS_ES_REGION'],
  constants: ['OST_STAKER_ADDR', 'OST_REDEEMER_ADDR']
};

configStrategy.kinds = kinds;

configStrategy.invertedKinds = util.invert(kinds);

configStrategy.keysTobeKeptUnencrypted = keysToBeKeptUnencrypted;

configStrategy.keysToEncrypt = keysToEncrypt;

configStrategy.identifierKeys = identifierKeys;

module.exports = configStrategy;
