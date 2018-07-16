"use strict";

const openStorage = require('@openstfoundation/openst-storage')
;

const rootPrefix = "../.."
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , autoscalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
  , dynamoDBFormatter = require(rootPrefix + '/lib/elasticsearch/helpers/dynamo_formatters')
  , TokenBalanceModel = openStorage.TokenBalanceModel
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , commonValidator = require(rootPrefix +  '/lib/validators/common')
;

const Limit = 20;

function AddPessimisticSettledBalanceToExistingDDBData(params) {

  const oThis = this;

  oThis.shardName = params.shard_name;

  oThis.scanParams = {
    TableName: oThis.shardName,
    Select: "SPECIFIC_ATTRIBUTES",
    AttributesToGet: ['ea', 'erc20', 'sb', 'ud'],
    Limit: Limit
  };

}

AddPessimisticSettledBalanceToExistingDDBData.prototype = {

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
            internal_error_identifier: 'e_drdm_apsbtedd_1',
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

    let batchNo = 1;

    while (true) {

      logger.info('starting to fetch data from DDB for batch: ', batchNo);

      let dDbRsp = await ddbServiceObj.scan(oThis.scanParams)
        , items = dDbRsp.data.Items
        , lastEvaluatedKeyHash = dDbRsp.data && dDbRsp.data.LastEvaluatedKey
      ;

      logger.info('fetched data from DDB for batch: ', batchNo);

      await oThis._processBatchOfItems(items);

      if (!lastEvaluatedKeyHash) {
        // No  more pages to fetch. break execution
        break;
      }

      oThis.scanParams['ExclusiveStartKey'] = lastEvaluatedKeyHash;
      batchNo += 1;

    }

  },

  /**
   * process batch of items returned by DDB
   *
   * @returns {promise}
   */
  _processBatchOfItems: async function(items) {

    const oThis = this
    ;
    
    let promises = [];

    logger.info('updating DDB Data');

    for (let i=0; i<items.length; i++) {

      let item = items[i]
        , userAddress = dynamoDBFormatter.toString( item.ea )
        , contractAddress = dynamoDBFormatter.toString( item.erc20 )
        , settledBalanceBN = dynamoDBFormatter.toBN( item.sb )
        , unsettledDebitsBN = dynamoDBFormatter.toBN( item.ud )
      ;

      console.log('settledBalanceN', settledBalanceBN.toString(10));
      console.log('unsettledDebitsN', unsettledDebitsBN.toString(10));

      promises.push(new TokenBalanceModel({
        shard_name: oThis.shardName,
        erc20_contract_address: contractAddress,
        ddb_service: ddbServiceObj,
        auto_scaling: autoscalingServiceObj
      }).set({
        ethereum_address: userAddress,
        pessimistic_settled_balance: settledBalanceBN.minus(unsettledDebitsBN).toString(10)
      }));

    }

    let promiseResponses = await Promise.all(promises);

    for (let i=0; i<promiseResponses.length; i++) {
      if(promiseResponses[i].isFailure()) {
        return Promise.reject(promiseResponses[i]);
      }
    }

  }

};

const usageDemo = function () {
  logger.log('usage:', 'node ./executables/ddb_related_data_migrations/add_pessimistic_settled_balance_to_existing_ddb_data.js shardName');
};

const args = process.argv
  , shardName = args[2]
;

const validateAndSanitize = function () {
  if (commonValidator.isVarNull(shardName)) {
    logger.error('shardName is NOT present in the arguments.');
    usageDemo();
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

const object = new AddPessimisticSettledBalanceToExistingDDBData({shard_name: shardName});
object.perform().then(function (a) {
  console.log(JSON.stringify(a.toHash()));
  process.exit(0)
}).catch(function (a) {
  console.error(JSON.stringify(a));
  process.exit(1)
});

