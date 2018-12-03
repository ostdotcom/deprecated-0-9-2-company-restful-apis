'use strict';

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util');

const configStrategy = {
  dynamo: 'dynamo',

  dax: 'dax',

  memcached: 'memcached',

  nonce_memcached: 'nonce_memcached',

  in_memory: 'in_memory',

  value_geth: 'value_geth',

  value_constants: 'value_constants',

  utility_geth: 'utility_geth',

  utility_constants: 'utility_constants',

  autoscaling: 'autoscaling',

  es: 'es',

  rmq: 'rmq',

  shared_rmq: 'shared_rmq',

  constants: 'constants',

  activeStatus: 'active',

  inActiveStatus: 'inactive',

  gethChainType: 'geth',

  parityChainType: 'parity'
};

const kinds = {
  '1': configStrategy.dynamo,
  // '2': configStrategy.dax,
  // '3': configStrategy.redis,
  '4': configStrategy.memcached,
  '5': configStrategy.in_memory,
  '6': configStrategy.value_geth,
  '7': configStrategy.value_constants,
  '8': configStrategy.utility_geth,
  '9': configStrategy.utility_constants,
  '10': configStrategy.autoscaling,
  '11': configStrategy.es,
  '12': configStrategy.constants,
  '13': configStrategy.rmq,
  '14': configStrategy.nonce_memcached,
  '15': configStrategy.shared_rmq
};

const keysToBeKeptUnencrypted = {};

keysToBeKeptUnencrypted[configStrategy.dynamo] = [
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
];

keysToBeKeptUnencrypted[configStrategy.dax] = [
  'OS_DAX_API_VERSION',
  'OS_DAX_ACCESS_KEY_ID',
  'OS_DAX_REGION',
  'OS_DAX_ENDPOINT',
  'OS_DAX_SSL_ENABLED'
];

keysToBeKeptUnencrypted[configStrategy.memcached] = ['OST_MEMCACHE_SERVERS'];

keysToBeKeptUnencrypted[configStrategy.nonce_memcached] = ['OST_NONCE_MEMCACHE_SERVERS'];

keysToBeKeptUnencrypted[configStrategy.in_memory] = ['OST_INMEMORY_CACHE_NAMESPACE'];

keysToBeKeptUnencrypted[configStrategy.value_geth] = [
  'OST_VALUE_GETH_RPC_PROVIDER',
  'OST_VALUE_GETH_RPC_PROVIDERS',
  'OST_VALUE_GETH_WS_PROVIDER',
  'OST_VALUE_GETH_WS_PROVIDERS',
  'OST_VALUE_CHAIN_ID',
  'OST_VALUE_CHAIN_TYPE'
];

keysToBeKeptUnencrypted[configStrategy.value_constants] = [
  'OST_VALUE_GAS_PRICE',
  'OST_OPENSTVALUE_CONTRACT_ADDR',
  'OST_VALUE_REGISTRAR_ADDR',
  'OST_VALUE_DEPLOYER_ADDR',
  'OST_VALUE_OPS_ADDR',
  'OST_VALUE_REGISTRAR_CONTRACT_ADDR',
  'OST_FOUNDATION_ADDR',
  'OST_SIMPLE_TOKEN_CONTRACT_ADDR',
  'OST_VALUE_ADMIN_ADDR'
];

keysToBeKeptUnencrypted[configStrategy.utility_geth] = [
  'read_only',
  'read_write',
  'OST_UTILITY_CHAIN_ID',
  'OST_UTILITY_CHAIN_TYPE'
];

keysToBeKeptUnencrypted[configStrategy.utility_constants] = [
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
  'OST_VALUE_CORE_CONTRACT_ADDR',
  'OST_UTILITY_ADMIN_ADDR'
];

keysToBeKeptUnencrypted[configStrategy.autoscaling] = [
  'AUTO_SCALE_DYNAMO',
  'OS_AUTOSCALING_API_VERSION',
  'OS_AUTOSCALING_ACCESS_KEY_ID',
  'OS_AUTOSCALING_REGION',
  'OS_AUTOSCALING_ENDPOINT',
  'OS_AUTOSCALING_SSL_ENABLED',
  'OS_AUTOSCALING_LOGGING_ENABLED'
];

keysToBeKeptUnencrypted[configStrategy.es] = ['CR_ES_HOST', 'AWS_ES_ACCESS_KEY', 'AWS_ES_REGION'];

keysToBeKeptUnencrypted[configStrategy.constants] = [
  'OST_STAKER_ADDR',
  'OST_REDEEMER_ADDR',
  'OST_CACHING_ENGINE',
  'OST_DEFAULT_TTL',
  'OST_CACHE_CONSISTENT_BEHAVIOR',
  'OST_STANDALONE_MODE'
];

keysToBeKeptUnencrypted[configStrategy.rmq] = [
  'OST_RMQ_USERNAME',
  'OST_RMQ_HOST',
  'OST_RMQ_PORT',
  'OST_RMQ_HEARTBEATS',
  'OST_RMQ_CLUSTER_NODES'
];

keysToBeKeptUnencrypted[configStrategy.shared_rmq] = [
  'OST_SHARED_RMQ_USERNAME',
  'OST_SHARED_RMQ_HOST',
  'OST_SHARED_RMQ_PORT',
  'OST_SHARED_RMQ_HEARTBEATS',
  'OST_SHARED_RMQ_CLUSTER_NODES'
];

const keysToEncrypt = {};

keysToEncrypt[configStrategy.dynamo] = ['OS_DYNAMODB_SECRET_ACCESS_KEY'];

keysToEncrypt[configStrategy.dax] = ['OS_DAX_SECRET_ACCESS_KEY'];

keysToEncrypt[configStrategy.memcached] = [];

keysToEncrypt[configStrategy.in_memory] = [];

keysToEncrypt[configStrategy.value_geth] = [];

keysToEncrypt[configStrategy.value_constants] = [
  'OST_VALUE_REGISTRAR_PASSPHRASE',
  'OST_VALUE_DEPLOYER_PASSPHRASE',
  'OST_VALUE_OPS_PASSPHRASE',
  'OST_FOUNDATION_PASSPHRASE',
  'OST_VALUE_ADMIN_PASSPHRASE'
];

keysToEncrypt[configStrategy.utility_geth] = [];

keysToEncrypt[configStrategy.utility_constants] = [
  'OST_UTILITY_CHAIN_OWNER_PASSPHRASE',
  'OST_UTILITY_INITIAL_ST_PRIME_HOLDER_PASSPHRASE',
  'OST_UTILITY_REGISTRAR_PASSPHRASE',
  'OST_UTILITY_DEPLOYER_PASSPHRASE',
  'OST_UTILITY_OPS_PASSPHRASE',
  'OST_UTILITY_ADMIN_PASSPHRASE'
];

keysToEncrypt[configStrategy.autoscaling] = ['OS_AUTOSCALING_SECRET_ACCESS_KEY'];

keysToEncrypt[configStrategy.es] = ['AWS_ES_SECRET_KEY'];

keysToEncrypt[configStrategy.constants] = ['OST_STAKER_PASSPHRASE', 'OST_REDEEMER_PASSPHRASE'];

keysToEncrypt[configStrategy.rmq] = ['OST_RMQ_PASSWORD'];

keysToEncrypt[configStrategy.shared_rmq] = ['OST_SHARED_RMQ_PASSWORD'];

const identifierKeys = {};

identifierKeys[configStrategy.dynamo] = [
  'OS_DYNAMODB_ACCESS_KEY_ID',
  'OS_DYNAMODB_ENDPOINT',
  'OS_DYNAMODB_API_VERSION',
  'OS_DYNAMODB_REGION',
  'OS_DYNAMODB_TABLE_NAME_PREFIX'
];

identifierKeys[configStrategy.dax] = ['OS_DAX_API_VERSION', 'OS_DAX_ACCESS_KEY_ID', 'OS_DAX_REGION', 'OS_DAX_ENDPOINT'];

identifierKeys[configStrategy.memcached] = ['OST_MEMCACHE_SERVERS'];

identifierKeys[configStrategy.nonce_memcached] = ['OST_NONCE_MEMCACHE_SERVERS'];

identifierKeys[configStrategy.in_memory] = ['OST_INMEMORY_CACHE_NAMESPACE'];

identifierKeys[configStrategy.value_geth] = [
  'OST_VALUE_GETH_RPC_PROVIDER',
  'OST_VALUE_GETH_RPC_PROVIDERS',
  'OST_VALUE_GETH_WS_PROVIDER',
  'OST_VALUE_GETH_WS_PROVIDERS',
  'OST_VALUE_CHAIN_ID'
];

identifierKeys[configStrategy.value_constants] = [
  'OST_VALUE_GAS_PRICE',
  'OST_OPENSTVALUE_CONTRACT_ADDR',
  'OST_VALUE_REGISTRAR_ADDR',
  'OST_VALUE_DEPLOYER_ADDR',
  'OST_VALUE_OPS_ADDR',
  'OST_VALUE_REGISTRAR_CONTRACT_ADDR',
  'OST_FOUNDATION_ADDR',
  'OST_SIMPLE_TOKEN_CONTRACT_ADDR',
  'OST_VALUE_ADMIN_ADDR'
];

identifierKeys[configStrategy.utility_geth] = ['read_only', 'read_write', 'OST_UTILITY_CHAIN_ID'];

identifierKeys[configStrategy.utility_constants] = [
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
  'OST_VALUE_CORE_CONTRACT_ADDR',
  'OST_UTILITY_ADMIN_ADDR'
];

identifierKeys[configStrategy.autoscaling] = [
  'OS_AUTOSCALING_API_VERSION',
  'OS_AUTOSCALING_ACCESS_KEY_ID',
  'OS_AUTOSCALING_REGION',
  'OS_AUTOSCALING_ENDPOINT',
  'OS_DYNAMODB_TABLE_NAME_PREFIX'
];

identifierKeys[configStrategy.es] = ['CR_ES_HOST', 'AWS_ES_ACCESS_KEY', 'AWS_ES_REGION'];

identifierKeys[configStrategy.constants] = ['OST_STAKER_ADDR', 'OST_REDEEMER_ADDR'];

identifierKeys[configStrategy.rmq] = ['OST_RMQ_USERNAME', 'OST_RMQ_HOST', 'OST_RMQ_PORT', 'OST_RMQ_CLUSTER_NODES'];

identifierKeys[configStrategy.shared_rmq] = [
  'OST_SHARED_RMQ_USERNAME',
  'OST_SHARED_RMQ_HOST',
  'OST_SHARED_RMQ_PORT',
  'OST_SHARED_RMQ_CLUSTER_NODES'
];
const statuses = {
  '1': configStrategy.activeStatus,
  '2': configStrategy.inActiveStatus
};

//These are the keys which can be changed while the config strategy's status is active.
const whiteListedKeys = {};

whiteListedKeys[configStrategy.value_geth] = [
  'OST_VALUE_GETH_RPC_PROVIDERS',
  'OST_VALUE_GETH_WS_PROVIDERS',
  'OST_VALUE_CHAIN_TYPE'
];

whiteListedKeys[configStrategy.utility_geth] = [
  'read_only',
  'read_write',
  'OST_UTILITY_CHAIN_TYPE',
  'OST_UTILITY_GETH_RPC_PROVIDERS',
  'OST_UTILITY_GETH_WS_PROVIDERS'
];

whiteListedKeys[configStrategy.rmq] = [
  'OST_RMQ_CLUSTER_NODES',
  'OST_RMQ_USERNAME',
  'OST_RMQ_PORT',
  'OST_RMQ_HEARTBEATS',
  'OST_RMQ_PASSWORD'
];

whiteListedKeys[configStrategy.shared_rmq] = ['OST_SHARED_RMQ_CLUSTER_NODES'];

const kindsWithoutGroupId = ['in_memory', 'value_geth', 'value_constants', 'constants', 'shared_rmq'];

configStrategy.kinds = kinds;

configStrategy.invertedKinds = util.invert(kinds);

const invertedStatuses = util.invert(statuses);

configStrategy.keysTobeKeptUnencrypted = keysToBeKeptUnencrypted;

configStrategy.keysToEncrypt = keysToEncrypt;

configStrategy.identifierKeys = identifierKeys;

configStrategy.kindsWithoutGroupId = kindsWithoutGroupId;

configStrategy.statuses = statuses;

configStrategy.invertedStatuses = invertedStatuses;

configStrategy.whiteListedKeys = whiteListedKeys;

module.exports = configStrategy;
