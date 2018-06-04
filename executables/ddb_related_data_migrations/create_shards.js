'use strict';

const OSTStorage = require('@openstfoundation/openst-storage')
;

const rootPrefix = '../..'
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
    , autoscalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
;

/**
 *
 * @param params
 *
 * @constructor
 *
 */
const CreateShards = function (params) {

  const oThis = this
  ;

  oThis.tokenBalancesShardCount = 4;
  oThis.transactionLogShardCount = 5;

};

CreateShards.prototype = {

  /**
   * Perform
   *
   * @return {promise}
   */
  perform: function () {
    const oThis = this
    ;

    return oThis.asyncPerform()
        .catch(function (error) {
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

    const oThis = this
    ;

    await oThis.createTokenBalancesShards();

    await oThis.createTransactionLogShards();

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * create token balances shards
   *
   * @returns {promise}
   */
  createTokenBalancesShards: async function () {

    const oThis = this
    ;

    for (let index = 1; index <= oThis.tokenBalancesShardCount; index++ ) {
      logger.info('starting to create tokenBalancesShard : ', index);
      let shardName = 'token_balances_shard_00' + index;
      let createRsp = await new OSTStorage.TokenBalanceModel({ddb_service: ddbServiceObj}).createAndRegisterShard(shardName);
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
  createTransactionLogShards: async function () {

    const oThis = this
    ;

    for (let index = 1; index <= oThis.transactionLogShardCount; index++ ) {
      logger.info('starting to create transactionLogShard : ', index);
      let shardName = 'transaction_logs_shard_00' + index;
      let createRsp = await new OSTStorage.TransactionLogModel({ddb_service: ddbServiceObj}).createAndRegisterShard(shardName);
      if (createRsp.isFailure()) {
        return Promise.reject(createRsp);
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

const object = new CreateShards({});
object.perform().then(console.log);