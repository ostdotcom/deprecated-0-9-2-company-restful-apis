'use strict';

/*
* This file is used to populate config_strategies table and chain_geth_providers table.
*
* Usage:  node executables/one_timers/config_strategy_seed.js managed_address_salt_id group_id [config file path]
*
* Pass managed_address_salt_id, and group_id as arguments when running this script.
*
*
* */
const group_id = process.argv[3];
const env_list = process.argv[4] ? require(process.argv[4]) : process.env;

const rootPrefix = '../..',
  configStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  ChainGethProviderModel = require(rootPrefix + '/app/models/chain_geth_providers'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

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

    await oThis.seed_redis_params();
    await oThis.seed_dynamo_params();
    await oThis.seed_memcached_params();
    await oThis.seed_autoscaling_params();
    await oThis.seed_in_memory_params();
    await oThis.seed_constants_params();
    await oThis.seed_dax_params();
    await oThis.seed_es_params();
    await oThis.seed_utility_constants_params();
    await oThis.seed_utility_geth_params();
    await oThis.seed_value_constants_params();
    await oThis.seed_value_geth_params();

    console.log('Success');
    process.exit(0);
  },

  seed_redis_params: async function() {
    let redis_params = {};
    redis_params['OST_REDIS_HOST'] = env_list.OST_REDIS_HOST;
    redis_params['OST_REDIS_PORT'] = env_list.OST_REDIS_PORT;
    redis_params['OST_REDIS_PASS'] = env_list.OST_REDIS_PASS;
    redis_params['OST_REDIS_TLS_ENABLED'] = env_list.OST_REDIS_TLS_ENABLED;
    const configStrategy = new configStrategyModel();
    await configStrategy.create('redis', process.argv[2], redis_params, group_id).then();
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
    utility_geth_params['OST_UTILITY_GETH_RPC_PROVIDER'] = env_list.OST_UTILITY_GETH_RPC_PROVIDER;
    utility_geth_params['OST_UTILITY_GETH_WS_PROVIDER'] = env_list.OST_UTILITY_GETH_WS_PROVIDER;
    utility_geth_params['OST_UTILITY_GETH_RPC_PROVIDERS'] = env_list.OST_UTILITY_GETH_RPC_PROVIDERS;
    utility_geth_params['OST_UTILITY_GETH_WS_PROVIDERS'] = env_list.OST_UTILITY_GETH_WS_PROVIDERS;
    utility_geth_params['OST_UTILITY_CHAIN_ID'] = env_list.OST_UTILITY_CHAIN_ID;

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
