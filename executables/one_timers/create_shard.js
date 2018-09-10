/*
*  Script for creating new shard
*
*  Pre-checks - config provided in the input should contain key, OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY with data
*
*  node executables/ddb_related_data_migrations/create_init_shards.js ~/config.json 'token_balance/transaction_log' 'shard_name'
*
* */

'use strict';

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/storage');
require(rootPrefix + '/app/models/transaction_log');

const args = process.argv,
  config_file_path = args[2],
  configStrategy = require(config_file_path),
  shard_type = args[3],
  shard_name = args[4],
  instanceComposer = new InstanceComposer(configStrategy),
  storageProvider = instanceComposer.getStorageProvider(),
  openSTStorage = storageProvider.getInstance(),
  transactionLogModel = instanceComposer.getTransactionLogModel(),
  ddbServiceObj = openSTStorage.dynamoDBService,
  ClientConfigStrategyModel = require(rootPrefix + '/app/models/client_config_strategies'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  ConfigStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_multi_management/config_strategy');

/**
 *
 * @param params
 *
 * @constructor
 *
 */
const CreateShards = function() {
  const oThis = this;
};

CreateShards.prototype = {
  /**
   * Perform
   *
   * @return {promise}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'e_drdm_cs_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * asyncPerform - Perform asynchronously
   *
   * @returns {promise}
   */
  asyncPerform: async function() {
    const oThis = this;

    if (shard_type == 'token_balance') {
      await oThis.createTokenBalancesShards();
    }

    if (shard_type == 'transaction_log') {
      await oThis.createTransactionLogShards();
    }

    let response = await oThis._getStrategyIdToUpdate();

    await oThis.updateStrategy(response.data);

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * create token balances shards
   *
   * @returns {promise}
   */
  createTokenBalancesShards: async function() {
    const oThis = this;

    logger.info('starting to create tokenBalancesShard : ', shard_name);
    let createRsp = await new openSTStorage.model.TokenBalance({}).createShard(shard_name);

    if (createRsp.isFailure()) {
      return Promise.reject(createRsp);
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * create transaction logs shards
   *
   * @returns {promise}
   */
  createTransactionLogShards: async function() {
    const oThis = this;

    logger.info('starting to create transactionLogShard : ', shard_name);
    let createRsp = await new transactionLogModel({}).createShard(shard_name);
    if (createRsp.isFailure()) {
      return Promise.reject(createRsp);
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Get strategy Id to update from dynamo config
   *
   * @returns {promise}
   */
  _getStrategyIdToUpdate: async function() {
    const oThis = this;

    var params = {
      TableName: configStrategy.OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY[0],
      Limit: 1
    };

    let response = await ddbServiceObj.scan(params);

    if (response.isFailure()) {
      console.error('==== Config passed seems to be incorrect. No clients found in Dynamo');
      return response;
    }

    let client_id = parseInt(response.data.Items[0].ci.N);

    let query = new ClientConfigStrategyModel();

    query.select('config_strategy_id').where(['client_id = ? AND auxilary_data is not NULL', client_id]);

    let queryData = await query.fire();

    console.log('====queryData', queryData);

    let strategy_id = queryData[0].config_strategy_id;

    return responseHelper.successWithData(strategy_id);
  },

  /**
   * c
   *
   * @returns {promise}
   */

  updateStrategy: async function(strategy_id) {
    let configStrategyCacheObj = new ConfigStrategyCacheKlass({ strategyIds: [strategy_id] });
    let strategyMap = await configStrategyCacheObj.fetch();

    let configStrategy = strategyMap.data[strategy_id].dynamo;

    if (shard_type == 'token_balance') {
      configStrategy['OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY'].push(shard_name);
    }

    if (shard_type == 'transaction_log') {
      configStrategy['OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY'].push(shard_name);
    }

    let configStrategyModelObj = new ConfigStrategyModel();

    await configStrategyModelObj.updateStrategyId(strategy_id, configStrategy);

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

const object = new CreateShards();
object
  .perform()
  .then(function(a) {
    console.log(a.toHash());
    process.exit(1);
  })
  .catch(function(a) {
    console.log(a);
    process.exit(1);
  });
