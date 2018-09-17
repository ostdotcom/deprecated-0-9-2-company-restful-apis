'use strict';

/**
 * This script will populate available shard name arrays in config strategy table by fetching the details from
 * available_shards dynamo table.
 *
 */

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  ConfigStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_multi_management/config_strategy');

require(rootPrefix + '/lib/providers/storage');

const Limit = 20;

function PopulateShardNamesArrayInStrategy() {
  const oThis = this;
}

PopulateShardNamesArrayInStrategy.prototype = {
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
          internal_error_identifier: 'e_ot_psna_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  asyncPerform: async function() {
    const oThis = this;

    let strategyObj = new ConfigStrategyModel();

    let result = await strategyObj._getStrategyIdsByKindAndGroupId('dynamo');

    if (result.isFailure()) {
      return result;
    }

    let dynamoStrategyIdData = result.data;

    logger.info('====dynamoStrategyIdData', dynamoStrategyIdData);

    for (let i = 0; i < dynamoStrategyIdData.length; i++) {
      let strategyId = dynamoStrategyIdData[i].id;

      await oThis._extractShardNamesAndUpdateStrategy(strategyId);
    }
  },

  /**
   * asyncPerform - Perform asynchronously
   *
   * @returns {promise}
   */
  _extractShardNamesAndUpdateStrategy: async function(strategyId) {
    const oThis = this;

    let batchNo = 1,
      OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY = [],
      OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY = [];

    let configStrategyCacheObj = new ConfigStrategyCacheKlass({ strategyIds: [strategyId] });
    let strategyMap = await configStrategyCacheObj.fetch();

    logger.info('====strategyMap', strategyMap);

    let configStrategy = strategyMap.data[strategyId].dynamo,
      instanceComposer = new InstanceComposer(configStrategy),
      storageProvider = instanceComposer.getStorageProvider(),
      openSTStorage = storageProvider.getInstance(),
      ddbServiceObj = openSTStorage.dynamoDBService;

    logger.info('====configStrategy', configStrategy);

    let scanParams = {
      TableName: configStrategy.OS_DYNAMODB_TABLE_NAME_PREFIX + 'available_shards',
      Limit: Limit
    };

    while (true) {
      logger.info('starting to fetch data from DDB for batch: ', batchNo);

      let dDbRsp = await ddbServiceObj.scan(scanParams);

      if (dDbRsp.isFailure()) {
        console.log('==== NOT PROCESSING SHARDS FOR STRATEGY ID: ', strategyId, 'due to error');
        break;
      }

      let items = dDbRsp.data.Items,
        lastEvaluatedKeyHash = dDbRsp.data && dDbRsp.data.LastEvaluatedKey;

      logger.info('======fetched data from DDB for batch: ', batchNo);

      logger.info('Data:', items);

      for (let i = 0; i < items.length; i++) {
        if (items[i].ET.S === 'tokenBalance') {
          OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY.push(items[i].SN.S);
        }
        if (items[i].ET.S === 'transactionLog') {
          OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY.push(items[i].SN.S);
        }
      }

      logger.info('TokenBalance Shard Name', OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY);
      logger.info('TransactionLog Shard Name', OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY);

      if (!lastEvaluatedKeyHash) {
        // No  more pages to fetch. break execution

        configStrategy['OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY'] = OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY;
        configStrategy['OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY'] = OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY;

        let configStrategyModelObj = new ConfigStrategyModel();

        await configStrategyModelObj.updateStrategyId(strategyId, configStrategy);

        break;
      }

      oThis.scanParams['ExclusiveStartKey'] = lastEvaluatedKeyHash;
      batchNo += 1;
    }
  }
};

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/one_timers/shardManagementMigration.js');
};

const object = new PopulateShardNamesArrayInStrategy();
object
  .perform()
  .then(function(a) {
    console.log(JSON.stringify(a.toHash()));
    process.exit(0);
  })
  .catch(function(a) {
    console.error(JSON.stringify(a));
    process.exit(1);
  });
