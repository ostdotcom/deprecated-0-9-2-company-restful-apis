'use strict';

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  coreConstants = require(rootPrefix + '/config/core_constants');

require(rootPrefix + '/lib/providers/storage');
require(rootPrefix + '/app/models/transaction_log');

const args = process.argv,
  config_file_path = args[2],
  configStrategy = require(config_file_path),
  instanceComposer = new InstanceComposer(configStrategy),
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

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * create token balances shards
   *
   * @returns {promise}
   */
  createTokenBalancesShards: async function() {
    const oThis = this;

    for (let index = 1; index <= oThis.tokenBalancesShardCount; index++) {
      logger.info('starting to create tokenBalancesShard : ', index);
      let shardName = coreConstants.DYNAMODB_TABLE_NAME_PREFIX + 'token_balances_shard_00' + index;
      let createRsp = await new openSTStorage.model.TokenBalance({}).createShard(shardName);
      if (createRsp.isFailure()) {
        return Promise.reject(createRsp);
      }
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

    for (let index = 1; index <= oThis.transactionLogShardCount; index++) {
      logger.info('starting to create transactionLogShard : ', index);
      let shardName = coreConstants.DYNAMODB_TABLE_NAME_PREFIX + 'transaction_logs_shard_00' + index;
      let createRsp = await new transactionLogModel({}).createShard(shardName);
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

/*
*  node executables/ddb_related_data_migrations/create_init_shards.js ~/config.json
*
* */
