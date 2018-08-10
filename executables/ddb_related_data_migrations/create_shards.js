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
  tokenBalanceHash = args[3],
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
const CreateShards = function(params) {
  const oThis = this;

  oThis.ddbServiceObj = openSTStorage.dynamoDBService;

  oThis.tokenBalancesShardHash = tokenBalanceHash;
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

    for (let chainId in oThis.tokenBalancesShardHash) {
      for (let index = 1; index <= oThis.tokenBalancesShardHash[chainId]; index++) {
        logger.info('starting to create tokenBalancesShard : ', index, 'for ChainId:', chainId);

        console.log('===chainID', chainId);

        let shardName = coreConstants.DYNAMODB_TABLE_NAME_PREFIX + 'token_balances_shard_' + chainId + '_010' + index;

        let createRsp = await new openSTStorage.model.TokenBalance({
          ddb_service: oThis.ddbServiceObj
        }).createAndRegisterShard(shardName);

        if (createRsp.isFailure()) {
          return Promise.reject(createRsp);
        }
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
      let shardName = coreConstants.DYNAMODB_TABLE_NAME_PREFIX + 'transaction_logs_shard_010' + index;
      let createRsp = await new transactionLogModel({
        ddb_service: oThis.ddbServiceObj
      }).createAndRegisterShard(shardName);
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
