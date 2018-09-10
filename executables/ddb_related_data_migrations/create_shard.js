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
*  node executables/ddb_related_data_migrations/create_init_shards.js ~/config.json 'token_balance/transaction_log' 'shard_name'
*
* */
