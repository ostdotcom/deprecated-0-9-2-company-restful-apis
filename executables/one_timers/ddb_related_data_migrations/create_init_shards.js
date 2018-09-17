'use strict';

/**
 * This is used to create Token Balances Shard and Transaction Log Shard using openSTStorage Provider.
 * Default prefix for shard names are 'token_balances_shard_00' and 'transaction_logs_shard_00'.
 *
 * Usage: node executables/ddb_related_data_migrations/create_init_shards.js configStrategyFilePath
 * Example: node executables/ddb_related_data_migrations/create_init_shards.js ~/config.json
 *
 * @module executables/ddb_related_data_migrations/create_init_shards
 */

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  coreConstants = require(rootPrefix + '/config/core_constants');

require(rootPrefix + '/lib/providers/storage');
require(rootPrefix + '/app/models/transaction_log');

const args = process.argv,
  config_file_path = args[2];

let token_balance_shard_array = [],
  transaction_log_shard_array = [],
  configStrategy = {};

const usageDemo = function() {
  logger.log(
    'usage:',
    'node node executables/ddb_related_data_migrations/create_init_shards.js configStrategyFilePath'
  );
  logger.log('* configStrategyFilePath is the path to the file which is storing the config strategy info.');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!configStrategy) {
    logger.error('Config strategy file path is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }
  configStrategy = require(config_file_path);
};

// Validate and sanitize the input params.
validateAndSanitize();

const instanceComposer = new InstanceComposer(configStrategy),
  storageProvider = instanceComposer.getStorageProvider(),
  openSTStorage = storageProvider.getInstance(),
  transactionLogModel = instanceComposer.getTransactionLogModel();

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
    const oThis = this;

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
      let shardName = coreConstants.DYNAMODB_TABLE_NAME_PREFIX + 'token_balances_shard_00' + index;
      token_balance_shard_array.push(shardName);
      let createRsp = await new openSTStorage.model.TokenBalance({ shard_name: shardName }).createShard();
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
      let shardName = coreConstants.DYNAMODB_TABLE_NAME_PREFIX + 'transaction_logs_shard_00' + index;
      transaction_log_shard_array.push(shardName);
      let createRsp = await new transactionLogModel({ shard_name: shardName }).createShard();
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
    console.log(a.toHash());
    process.exit(1);
  })
  .catch(function(a) {
    console.log(a);
    process.exit(1);
  });
