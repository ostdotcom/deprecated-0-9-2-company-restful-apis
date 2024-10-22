'use strict';

/*
* This file is used to populate config_strategies table and chain_geth_providers table.
*
* Usage: node executables/config_strategy_seed.js managed_address_salt_id group_id configFilePath
*
* Command Line Parameters Description:
* managed_address_salt_id: from managed_address_salts table
* group_id: Group ID is used for client.
* configFilePath: Config strategy file path is necessary for seeding strategy in table.
*
* Note: config file should contain all service kinds present in this sheet: https://docs.google.com/spreadsheets/d/1DL55AZjgvaRM3S9JDVFJrfEA66aZBBab_PtJimzMzVo/edit#gid=0
*
* Example: node executables/config_strategy_seed.js 60010 1 ~/config.json
*
* */

const rootPrefix = '..',
  configStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const group_id = process.argv[3];
const managed_address_salt_id = process.argv[2];
let env_list;

const usageDemo = function() {
  logger.log(
    'usage:',
    'node executables/config_strategy_seed.js managed_address_salt_id group_id [configStrategyFilePath]'
  );
  logger.log(
    '* Managed address salt ID can be found in Managed address Salts table. It is used to encrypt the config strategies.'
  );
  logger.log(
    '* If managed address salt id is not present, use this script to insert new salt id: executables/insert_managed_address_salt_id.js'
  );
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!managed_address_salt_id) {
    logger.error('Managed address salt ID is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }
  if (!group_id) {
    logger.error('Group ID is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  env_list = process.argv[4] ? require(process.argv[4]) : process.env;

  if (!env_list) {
    logger.error('Config strategy file path is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

const seedConfigStrategies = function() {};

seedConfigStrategies.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error(error);
      process.exit(1);
    });
  },

  asyncPerform: async function() {
    const oThis = this;

    await oThis.seed_dynamo_params();
    await oThis.seed_memcached_params();
    await oThis.seed_nonce_memcached_params();
    await oThis.seed_autoscaling_params();
    await oThis.seed_in_memory_params();
    await oThis.seed_constants_params();
    // await oThis.seed_dax_params();
    await oThis.seed_es_params();
    await oThis.seed_utility_constants_params();
    await oThis.seed_utility_geth_params();
    await oThis.seed_value_constants_params();
    await oThis.seed_value_geth_params();
    await oThis.seed_rmq_params();
    await oThis.seed_shared_rmq_params();

    logger.log('Successfully seeded all config parameters!! ');
    process.exit(0);
  },

  seed_dynamo_params: async function() {
    let dynamo_params = {};
    dynamo_params['OS_DYNAMODB_ACCESS_KEY_ID'] = env_list.OS_DYNAMODB_ACCESS_KEY_ID;
    dynamo_params['OS_DYNAMODB_SECRET_ACCESS_KEY'] = env_list.OS_DYNAMODB_SECRET_ACCESS_KEY;
    dynamo_params['OS_DYNAMODB_SSL_ENABLED'] = env_list.OS_DYNAMODB_SSL_ENABLED;
    dynamo_params['OS_DYNAMODB_ENDPOINT'] = env_list.OS_DYNAMODB_ENDPOINT;
    dynamo_params['OS_DYNAMODB_API_VERSION'] = env_list.OS_DYNAMODB_API_VERSION;
    dynamo_params['OS_DYNAMODB_REGION'] = env_list.OS_DYNAMODB_REGION;
    dynamo_params['OS_DYNAMODB_LOGGING_ENABLED'] = env_list.OS_DYNAMODB_LOGGING_ENABLED;
    dynamo_params['OS_DYNAMODB_TABLE_NAME_PREFIX'] = env_list.OS_DYNAMODB_TABLE_NAME_PREFIX;
    dynamo_params['OS_DAX_ENABLED'] = env_list.OS_DAX_ENABLED;
    dynamo_params['OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY'] = env_list.OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY;
    dynamo_params['OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY'] = env_list.OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('dynamo', process.argv[2], dynamo_params, group_id).then();
  },

  seed_dax_params: async function() {
    let dax_params = {};
    dax_params['OS_DAX_API_VERSION'] = env_list.OS_DAX_API_VERSION;
    dax_params['OS_DAX_ACCESS_KEY_ID'] = env_list.OS_DAX_ACCESS_KEY_ID;
    dax_params['OS_DAX_SECRET_ACCESS_KEY'] = env_list.OS_DAX_SECRET_ACCESS_KEY;
    dax_params['OS_DAX_REGION'] = env_list.OS_DAX_REGION;
    dax_params['OS_DAX_ENDPOINT'] = env_list.OS_DAX_ENDPOINT;
    dax_params['OS_DAX_SSL_ENABLED'] = env_list.OS_DAX_SSL_ENABLED;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('dax', process.argv[2], dax_params, group_id).then();
  },

  seed_memcached_params: async function() {
    let memcached_params = {};
    memcached_params['OST_MEMCACHE_SERVERS'] = env_list.OST_MEMCACHE_SERVERS;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('memcached', process.argv[2], memcached_params, group_id).then();
  },

  seed_nonce_memcached_params: async function() {
    let memcached_params = {};
    memcached_params['OST_NONCE_MEMCACHE_SERVERS'] = env_list.OST_NONCE_MEMCACHE_SERVERS;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('nonce_memcached', process.argv[2], memcached_params, group_id).then();
  },

  seed_in_memory_params: async function() {
    let in_memory_params = {};
    in_memory_params['OST_INMEMORY_CACHE_NAMESPACE'] = env_list.OST_INMEMORY_CACHE_NAMESPACE;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('in_memory', process.argv[2], in_memory_params).then();
  },

  seed_value_geth_params: async function() {
    let value_geth_params = {};
    value_geth_params['OST_VALUE_GETH_RPC_PROVIDER'] = env_list.OST_VALUE_GETH_RPC_PROVIDER;
    value_geth_params['OST_VALUE_GETH_WS_PROVIDER'] = env_list.OST_VALUE_GETH_WS_PROVIDER;
    value_geth_params['OST_VALUE_GETH_RPC_PROVIDERS'] = env_list.OST_VALUE_GETH_RPC_PROVIDERS;
    value_geth_params['OST_VALUE_GETH_WS_PROVIDERS'] = env_list.OST_VALUE_GETH_WS_PROVIDERS;
    value_geth_params['OST_VALUE_CHAIN_ID'] = env_list.OST_VALUE_CHAIN_ID;
    value_geth_params['OST_VALUE_CHAIN_TYPE'] = env_list.OST_VALUE_CHAIN_TYPE;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('value_geth', process.argv[2], value_geth_params).then();
  },

  seed_value_constants_params: async function() {
    let value_constants_params = {};

    value_constants_params['OST_VALUE_GAS_PRICE'] = env_list.OST_VALUE_GAS_PRICE;
    value_constants_params['OST_OPENSTVALUE_CONTRACT_ADDR'] = env_list.OST_OPENSTVALUE_CONTRACT_ADDR;
    value_constants_params['OST_VALUE_REGISTRAR_ADDR'] = env_list.OST_VALUE_REGISTRAR_ADDR;
    value_constants_params['OST_VALUE_REGISTRAR_PASSPHRASE'] = env_list.OST_VALUE_REGISTRAR_PASSPHRASE;
    value_constants_params['OST_VALUE_DEPLOYER_ADDR'] = env_list.OST_VALUE_DEPLOYER_ADDR;
    value_constants_params['OST_VALUE_DEPLOYER_PASSPHRASE'] = env_list.OST_VALUE_DEPLOYER_PASSPHRASE;
    value_constants_params['OST_VALUE_ADMIN_ADDR'] = env_list.OST_VALUE_ADMIN_ADDR;
    value_constants_params['OST_VALUE_ADMIN_PASSPHRASE'] = env_list.OST_VALUE_ADMIN_PASSPHRASE;
    value_constants_params['OST_VALUE_OPS_ADDR'] = env_list.OST_VALUE_OPS_ADDR;
    value_constants_params['OST_VALUE_OPS_PASSPHRASE'] = env_list.OST_VALUE_OPS_PASSPHRASE;
    value_constants_params['OST_VALUE_REGISTRAR_CONTRACT_ADDR'] = env_list.OST_VALUE_REGISTRAR_CONTRACT_ADDR;
    value_constants_params['OST_FOUNDATION_ADDR'] = env_list.OST_FOUNDATION_ADDR;
    value_constants_params['OST_FOUNDATION_PASSPHRASE'] = env_list.OST_FOUNDATION_PASSPHRASE;
    value_constants_params['OST_SIMPLE_TOKEN_CONTRACT_ADDR'] = env_list.OST_SIMPLE_TOKEN_CONTRACT_ADDR;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('value_constants', process.argv[2], value_constants_params).then();
  },

  seed_utility_geth_params: async function() {
    let utility_geth_params = {};
    let geth_params = {
      OST_UTILITY_GETH_RPC_PROVIDER: env_list.OST_UTILITY_GETH_RPC_PROVIDER,
      OST_UTILITY_GETH_WS_PROVIDER: env_list.OST_UTILITY_GETH_WS_PROVIDER,
      OST_UTILITY_GETH_RPC_PROVIDERS: env_list.OST_UTILITY_GETH_RPC_PROVIDERS,
      OST_UTILITY_GETH_WS_PROVIDERS: env_list.OST_UTILITY_GETH_WS_PROVIDERS
    };
    utility_geth_params['OST_UTILITY_CHAIN_ID'] = env_list.OST_UTILITY_CHAIN_ID;
    utility_geth_params['OST_UTILITY_CHAIN_TYPE'] = env_list.OST_UTILITY_CHAIN_TYPE;
    utility_geth_params['read_only'] = geth_params;
    utility_geth_params['read_write'] = geth_params;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('utility_geth', process.argv[2], utility_geth_params, group_id).then();
  },

  seed_utility_constants_params: async function() {
    let utility_constants_params = {};
    utility_constants_params['OST_UTILITY_GAS_PRICE'] = env_list.OST_UTILITY_GAS_PRICE;
    utility_constants_params['OST_OPENSTUTILITY_ST_PRIME_UUID'] = env_list.OST_OPENSTUTILITY_ST_PRIME_UUID;
    utility_constants_params['OST_UTILITY_CHAIN_OWNER_ADDR'] = env_list.OST_UTILITY_CHAIN_OWNER_ADDR;
    utility_constants_params['OST_UTILITY_CHAIN_OWNER_PASSPHRASE'] = env_list.OST_UTILITY_CHAIN_OWNER_PASSPHRASE;
    utility_constants_params['OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR'] =
      env_list.OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR;
    utility_constants_params['OST_UTILITY_INITIAL_ST_PRIME_HOLDER_PASSPHRASE'] =
      env_list.OST_UTILITY_INITIAL_ST_PRIME_HOLDER_PASSPHRASE;
    utility_constants_params['OST_UTILITY_REGISTRAR_ADDR'] = env_list.OST_UTILITY_REGISTRAR_ADDR;
    utility_constants_params['OST_UTILITY_REGISTRAR_PASSPHRASE'] = env_list.OST_UTILITY_REGISTRAR_PASSPHRASE;
    utility_constants_params['OST_OPENSTUTILITY_CONTRACT_ADDR'] = env_list.OST_OPENSTUTILITY_CONTRACT_ADDR;
    utility_constants_params['OST_UTILITY_REGISTRAR_CONTRACT_ADDR'] = env_list.OST_UTILITY_REGISTRAR_CONTRACT_ADDR;
    utility_constants_params['OST_UTILITY_DEPLOYER_ADDR'] = env_list.OST_UTILITY_DEPLOYER_ADDR;
    utility_constants_params['OST_UTILITY_DEPLOYER_PASSPHRASE'] = env_list.OST_UTILITY_DEPLOYER_PASSPHRASE;
    utility_constants_params['OST_UTILITY_OPS_ADDR'] = env_list.OST_UTILITY_OPS_ADDR;
    utility_constants_params['OST_UTILITY_OPS_PASSPHRASE'] = env_list.OST_UTILITY_OPS_PASSPHRASE;
    utility_constants_params['OST_UTILITY_ADMIN_ADDR'] = env_list.OST_UTILITY_ADMIN_ADDR;
    utility_constants_params['OST_UTILITY_ADMIN_PASSPHRASE'] = env_list.OST_UTILITY_ADMIN_PASSPHRASE;
    utility_constants_params['OST_STPRIME_CONTRACT_ADDR'] = env_list.OST_STPRIME_CONTRACT_ADDR;
    utility_constants_params['OST_UTILITY_PRICE_ORACLES'] = env_list.OST_UTILITY_PRICE_ORACLES;
    utility_constants_params['OST_UTILITY_WORKERS_CONTRACT_ADDRESS'] = env_list.OST_UTILITY_WORKERS_CONTRACT_ADDRESS;
    utility_constants_params['OST_VALUE_CORE_CONTRACT_ADDR'] = env_list.OST_VALUE_CORE_CONTRACT_ADDR;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('utility_constants', process.argv[2], utility_constants_params, group_id).then();
  },

  seed_autoscaling_params: async function() {
    let autoscaling_params = {};
    autoscaling_params['AUTO_SCALE_DYNAMO'] = env_list.AUTO_SCALE_DYNAMO;
    autoscaling_params['OS_AUTOSCALING_API_VERSION'] = env_list.OS_AUTOSCALING_API_VERSION;
    autoscaling_params['OS_AUTOSCALING_ACCESS_KEY_ID'] = env_list.OS_AUTOSCALING_ACCESS_KEY_ID;
    autoscaling_params['OS_AUTOSCALING_SECRET_ACCESS_KEY'] = env_list.OS_AUTOSCALING_SECRET_ACCESS_KEY;
    autoscaling_params['OS_AUTOSCALING_REGION'] = env_list.OS_AUTOSCALING_REGION;
    autoscaling_params['OS_AUTOSCALING_ENDPOINT'] = env_list.OS_AUTOSCALING_ENDPOINT;
    autoscaling_params['OS_AUTOSCALING_SSL_ENABLED'] = env_list.OS_AUTOSCALING_SSL_ENABLED;
    autoscaling_params['OS_AUTOSCALING_LOGGING_ENABLED'] = env_list.OS_AUTOSCALING_LOGGING_ENABLED;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('autoscaling', process.argv[2], autoscaling_params, group_id).then();
  },

  seed_es_params: async function() {
    let es_params = {};
    es_params['CR_ES_HOST'] = env_list.CR_ES_HOST;
    es_params['AWS_ES_ACCESS_KEY'] = env_list.AWS_ES_ACCESS_KEY;
    es_params['AWS_ES_SECRET_KEY'] = env_list.AWS_ES_SECRET_KEY;
    es_params['AWS_ES_REGION'] = env_list.AWS_ES_REGION;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('es', process.argv[2], es_params, group_id).then();
  },

  seed_constants_params: async function() {
    let constants_params = {};
    constants_params['OST_STAKER_ADDR'] = env_list.OST_STAKER_ADDR;
    constants_params['OST_STAKER_PASSPHRASE'] = env_list.OST_STAKER_PASSPHRASE;
    constants_params['OST_REDEEMER_ADDR'] = env_list.OST_REDEEMER_ADDR;
    constants_params['OST_REDEEMER_PASSPHRASE'] = env_list.OST_REDEEMER_PASSPHRASE;
    constants_params['OST_CACHING_ENGINE'] = env_list.OST_CACHING_ENGINE;
    constants_params['OST_DEFAULT_TTL'] = env_list.OST_DEFAULT_TTL;
    constants_params['OST_STANDALONE_MODE'] = env_list.OST_STANDALONE_MODE;
    constants_params['OST_CACHE_CONSISTENT_BEHAVIOR'] = env_list.OST_CACHE_CONSISTENT_BEHAVIOR;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('constants', process.argv[2], constants_params).then();
  },

  seed_rmq_params: async function() {
    let rmq_params = {};
    rmq_params['OST_RMQ_USERNAME'] = env_list.OST_RMQ_USERNAME;
    rmq_params['OST_RMQ_PASSWORD'] = env_list.OST_RMQ_PASSWORD;
    rmq_params['OST_RMQ_HOST'] = env_list.OST_RMQ_HOST;
    rmq_params['OST_RMQ_PORT'] = env_list.OST_RMQ_PORT;
    rmq_params['OST_RMQ_HEARTBEATS'] = env_list.OST_RMQ_HEARTBEATS;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('rmq', process.argv[2], rmq_params, group_id).then();
  },

  seed_shared_rmq_params: async function() {
    let shared_rmq_params = {};
    shared_rmq_params['OST_SHARED_RMQ_USERNAME'] = env_list.OST_SHARED_RMQ_USERNAME;
    shared_rmq_params['OST_SHARED_RMQ_PASSWORD'] = env_list.OST_SHARED_RMQ_PASSWORD;
    shared_rmq_params['OST_SHARED_RMQ_HOST'] = env_list.OST_SHARED_RMQ_HOST;
    shared_rmq_params['OST_SHARED_RMQ_PORT'] = env_list.OST_SHARED_RMQ_PORT;
    shared_rmq_params['OST_SHARED_RMQ_HEARTBEATS'] = env_list.OST_SHARED_RMQ_HEARTBEATS;
    shared_rmq_params['OST_SHARED_RMQ_CLUSTER_NODES'] = env_list.OST_SHARED_RMQ_CLUSTER_NODES;

    const configStrategy = new configStrategyModel();

    await configStrategy.create('shared_rmq', process.argv[2], shared_rmq_params);
  },

  populateChainGethProviders: async function() {
    let promises = [],
      valueRpcProviders = JSON.parse(env_list.OST_VALUE_GETH_RPC_PROVIDERS),
      valueWsProviders = JSON.parse(env_list.OST_VALUE_GETH_WS_PROVIDERS),
      utilityRpcProviders = JSON.parse(env_list.OST_UTILITY_GETH_RPC_PROVIDERS),
      utilityWsProviders = JSON.parse(env_list.OST_UTILITY_GETH_WS_PROVIDERS);

    // Value Chain
    for (let i = 0; i < valueRpcProviders.length; i++) {
      promises.push(
        new ChainGethProviderModel().insertRecord({
          chain_id: parseInt(env_list.OST_VALUE_CHAIN_ID),
          chain_kind: 'value',
          ws_provider: valueWsProviders[i],
          rpc_provider: valueRpcProviders[i]
        })
      );
    }

    // Utility Chain
    for (let i = 0; i < utilityRpcProviders.length; i++) {
      promises.push(
        new ChainGethProviderModel().insertRecord({
          chain_id: parseInt(env_list.OST_UTILITY_CHAIN_ID),
          chain_kind: 'utility',
          ws_provider: utilityWsProviders[i],
          rpc_provider: utilityRpcProviders[i]
        })
      );
    }

    await Promise.all(promises);
  }
};

new seedConfigStrategies().perform().then();
