'use strict';

/**
 * This is used to create Token Balances Shard and Transaction Log Shard using openSTStorage Provider.
 * Default prefix for shard names are 'token_balances_shard_00' and 'transaction_logs_shard_00'.
 *
 * Usage: node executables/create_init_shards.js groupId
 * Example: node executables/create_init_shards.js 1
 *
 * @module executables/create_init_shards.js
 */

const rootPrefix = '..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/storage');
require(rootPrefix + '/app/models/transaction_log');

const args = process.argv,
  group_id = args[2];

let token_balance_shard_array = [],
  transaction_log_shard_array = [];

const usageDemo = function() {
  logger.log(
    'usage:',
    'node node executables/ddb_related_data_migrations/create_init_shards.js configStrategyFilePath'
  );
  logger.log('* configStrategyFilePath is the path to the file which is storing the config strategy info.');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!group_id) {
    logger.error('Group id is not passed');
    usageDemo();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

/**
 *
 * @param params
 *
 * @constructor
 *
 */
const CreateShards = function() {
  const oThis = this;

  oThis.tokenBalancesShardCount = 2;
  oThis.transactionLogShardCount = 2;
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
    const oThis = this,
      strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash();

    oThis.configStrategy = configStrategyResp.data;

    let instanceComposer = new InstanceComposer(oThis.configStrategy),
      storageProvider = instanceComposer.getStorageProvider();

    oThis.transactionLogModel = instanceComposer.getTransactionLogModel();
    oThis.openSTStorage = storageProvider.getInstance();

    await oThis.createTokenBalancesShards();

    await oThis.createTransactionLogShards();

    logger.win({
      token_balance_shard_array: token_balance_shard_array,
      transaction_log_shard_array: transaction_log_shard_array
    });

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * create Token Balances Shards
   *
   * @returns {promise}
   */
  createTokenBalancesShards: async function() {
    const oThis = this;

    for (let index = 1; index <= oThis.tokenBalancesShardCount; index++) {
      logger.info('starting to create tokenBalancesShard : ', index);
      let shardName = oThis.configStrategy.OS_DYNAMODB_TABLE_NAME_PREFIX + 'token_balances_shard_00' + index;
      token_balance_shard_array.push(shardName);
      let createRsp = await new oThis.openSTStorage.model.TokenBalance({ shard_name: shardName }).createShard();
      if (createRsp.isFailure()) {
        return Promise.reject(createRsp);
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Create Transaction Logs Shards
   *
   * @returns {promise}
   */
  createTransactionLogShards: async function() {
    const oThis = this;

    for (let index = 1; index <= oThis.transactionLogShardCount; index++) {
      logger.info('starting to create transactionLogShard : ', index);
      let shardName = oThis.configStrategy.OS_DYNAMODB_TABLE_NAME_PREFIX + 'transaction_logs_shard_00' + index;
      transaction_log_shard_array.push(shardName);
      let createRsp = await new oThis.transactionLogModel({ shard_name: shardName }).createShard();
      if (createRsp.isFailure()) {
        return Promise.reject(createRsp);
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

const object = new CreateShards();
object
  .perform()
  .then(function(a) {
    logger.log(a.toHash());
    process.exit(1);
  })
  .catch(function(a) {
    logger.log(a);
    process.exit(1);
  });
