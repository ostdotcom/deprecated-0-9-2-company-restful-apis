'use strict';

const rootPrefix = '..';
const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  clientConfigStrategyCacheKlass = require(rootPrefix + '/lib/cache_management/client_config_strategies'),
  configStrategyCacheKlass = require(rootPrefix + '/lib/cache_multi_management/config_strategy');

/**
 *
 * @constructor
 */
const ConfigStrategyKlass = function() {
  const oThis = this;
};

ConfigStrategyKlass.prototype = {
  /**
   * Get final hash of config strategy
   */
  getConfigStrategy: async function(clientId) {
    const clientConfigStrategyCacheObj = new clientConfigStrategyCacheKlass({ clientId: clientId }),
      strategyIds = await clientConfigStrategyCacheObj.fetch(),
      strategyIdsArray = strategyIds.data;

    const configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: strategyIdsArray });

    let configStrategyHash = await configStrategyCacheObj.fetch();

    let configStrategyFlatHash = {
      OST_REDIS_HOST: '127.0.0.1',
      OST_REDIS_PORT: '6379',
      OST_REDIS_PASS: 'st123',
      OST_REDIS_TLS_ENABLED: '0',
      OS_DYNAMODB_ACCESS_KEY_ID: 'x',
      OS_DYNAMODB_SECRET_ACCESS_KEY: 'x',
      OS_DYNAMODB_SSL_ENABLED: '0',
      OS_DYNAMODB_ENDPOINT: 'http://localhost:8000',
      OS_DYNAMODB_API_VERSION: '2012-08-10',
      OS_DYNAMODB_REGION: 'localhost',
      OS_DYNAMODB_LOGGING_ENABLED: '0',
      OS_DYNAMODB_TABLE_NAME_PREFIX: 'd_pk_',
      OS_DAX_API_VERSION: '2017-04-19',
      OS_DAX_ACCESS_KEY_ID: 'x',
      OS_DAX_SECRET_ACCESS_KEY: 'x',
      OS_DAX_REGION: 'local',
      OS_DAX_ENDPOINT: 'http://localhost:8000',
      OS_DAX_SSL_ENABLED: '0',
      OST_MEMCACHE_SERVERS: '127.0.0.1:11211',
      OST_VALUE_GETH_RPC_PROVIDER: 'http://127.0.0.1:8545',
      OST_VALUE_GETH_WS_PROVIDER: 'ws://127.0.0.1:18545',
      OST_VALUE_CHAIN_ID: '2001',
      OST_VALUE_GAS_PRICE: '0xBA43B7400',
      OST_OPENSTVALUE_CONTRACT_ADDR: '0xD266bfCd4779202Fe143E7743aeD7a533eC13e84',
      OST_VALUE_REGISTRAR_ADDR: '0xaf576b4AF747b3faAb3666302278f1cE5E55EC81',
      OST_VALUE_REGISTRAR_PASSPHRASE: 'testtest',
      OST_VALUE_DEPLOYER_ADDR: '0x616FaF5B8C960c1a92de47CDb91b088a0879c335',
      OST_VALUE_DEPLOYER_PASSPHRASE: 'testtest',
      OST_VALUE_OPS_PASSPHRASE: 'testtest',
      OST_VALUE_CORE_CONTRACT_ADDR: '0x5CB3BE979Da33ba68797C93aA58b0Cac2BD5E565',
      OST_VALUE_REGISTRAR_CONTRACT_ADDR: '0x5916Aa1c4aB168cA0D7B024b254C7d3E0E04FC36',
      OST_FOUNDATION_ADDR: '0x9B17f925dBbd1b86E8b952391afa45757531C0fb',
      OST_FOUNDATION_PASSPHRASE: 'testtest',
      OST_SIMPLE_TOKEN_CONTRACT_ADDR: '0xFa62d8A792A9bcB8d7b4fd563C2c6B92400379D4',
      OST_UTILITY_GETH_RPC_PROVIDER: 'http://127.0.0.1:9546',
      OST_UTILITY_GETH_WS_PROVIDER: 'ws://127.0.0.1:19546',
      OST_UTILITY_CHAIN_ID: '2000',
      OST_UTILITY_GAS_PRICE: '0x0',
      OST_OPENSTUTILITY_ST_PRIME_UUID: '0xf1be674dd061f5f8573cee93cf06f050114db43a972e20ea9987ccf96da1e1cc',
      OST_UTILITY_CHAIN_OWNER_ADDR: '0x0dAf1564a989C457FeB562Ca2E520318d827E728',
      OST_UTILITY_CHAIN_OWNER_PASSPHRASE: 'testtest',
      OST_UTILITY_INITIAL_ST_PRIME_HOLDER_ADDR: '0xcA05BB03CF2A5798914967bE347BF44c24f5b1D3',
      OST_UTILITY_INITIAL_ST_PRIME_HOLDER_PASSPHRASE: 'testtest',
      OST_UTILITY_REGISTRAR_ADDR: '0x32320A2b5f27f569BeCd9a346523C21380Bec549',
      OST_UTILITY_REGISTRAR_PASSPHRASE: 'testtest',
      OST_OPENSTUTILITY_CONTRACT_ADDR: '0xF1E0956eE3f8a6bC75057D3f2E87436E7ED5d6cD',
      OST_UTILITY_REGISTRAR_CONTRACT_ADDR: '0x1839c5087f9A3A7655E4D12F3f14408A6C3fE5E5',
      OST_UTILITY_DEPLOYER_ADDR: '0xD5915Cb71B4b479cAdd572B18D5cf50B94BbBd70',
      OST_UTILITY_DEPLOYER_PASSPHRASE: 'testtest',
      OST_UTILITY_OPS_ADDR: '0x07006016874F2A14c969f449b3Ae9d831b560Ef3',
      OST_UTILITY_OPS_PASSPHRASE: 'testtest',
      OST_STPRIME_CONTRACT_ADDR: '0x3C5f46fbe469418bac8b6eaD744487E35E6a29F7',
      AUTO_SCALE_DYNAMO: '0',
      OS_AUTOSCALING_API_VERSION: '2016-02-06',
      OS_AUTOSCALING_ACCESS_KEY_ID: 'x',
      OS_AUTOSCALING_SECRET_ACCESS_KEY: 'x',
      OS_AUTOSCALING_REGION: 'localhost',
      OS_AUTOSCALING_ENDPOINT: 'http://localhost:8000',
      OS_AUTOSCALING_SSL_ENABLED: '0',
      OS_AUTOSCALING_LOGGING_ENABLED: '0',
      CR_ES_HOST: 'http://localhost:9200',
      AWS_ES_ACCESS_KEY: 'AKIAJUDRALNURKAVS5IQ',
      AWS_ES_SECRET_KEY: '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',
      AWS_ES_REGION: 'us-east-1',
      OST_STAKER_ADDR: '0xfcCfc08905CC8aB8C36aC739e28dDb8f3EEebF72',
      OST_STAKER_PASSPHRASE: 'testtest',
      OST_REDEEMER_ADDR: '0x9A408C03E672B056a8dFa432782DECe52Cd9BC83',
      OST_REDEEMER_PASSPHRASE: 'testtest',
      OST_CACHING_ENGINE: 'redis',
      OST_DEFAULT_TTL: '36000',
      OST_STANDALONE_MODE: '1'
    };
    return configStrategyFlatHash;
  }
};

module.exports = ConfigStrategyKlass;
