'use strict';

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  dynamoDBFormatter = require(rootPrefix + '/lib/elasticsearch/helpers/dynamo_formatters'),
  InsertInESKlass = require(rootPrefix + '/executables/es_related/insert_from_transaction_log_ddb_to_es'),
  insertInESobj = new InsertInESKlass(),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  commonValidator = require(rootPrefix + '/lib/validators/common');

require(rootPrefix + '/lib/providers/storage');

const args = process.argv,
  config_file_path = args[2],
  shardName = args[3],
  configStrategy = require(config_file_path),
  instanceComposer = new InstanceComposer(configStrategy),
  storageProvider = instanceComposer.getStorageProvider(),
  openSTStorage = storageProvider.getInstance(),
  ddbServiceObj = openSTStorage.dynamoDBService;

const Limit = 20;

function MigrateDataFromDDbToES(params) {
  const oThis = this;

  oThis.shardName = params.shard_name;

  oThis.scanParams = {
    TableName: oThis.shardName,
    Select: 'SPECIFIC_ATTRIBUTES',
    AttributesToGet: ['txu'],
    Limit: Limit
  };
}

MigrateDataFromDDbToES.prototype = {
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
          internal_error_identifier: 'e_drdm_madfdte_1',
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

    let batchNo = 1;

    while (true) {
      logger.info('starting to fetch data from DDB for batch: ', batchNo);

      let dDbRsp = await ddbServiceObj.scan(oThis.scanParams),
        items = dDbRsp.data.Items,
        lastEvaluatedKeyHash = dDbRsp.data && dDbRsp.data.LastEvaluatedKey;

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
    const oThis = this;

    let transactionUuids = [];

    logger.info('Inserting Data in ES');

    for (let i = 0; i < items.length; i++) {
      transactionUuids.push(dynamoDBFormatter.toString(items[i].txu));
    }

    console.log('transactionUuids', transactionUuids);

    await insertInESobj.insertRecordsInES(oThis.shardName, transactionUuids);
  }
};

const usageDemo = function() {
  logger.log(
    'usage:',
    'node ./executables/es_related/migrate_all_data_from_ddb_to_es.js configStrategy_file_path shardName'
  );
};

const validateAndSanitize = function() {
  if (commonValidator.isVarNull(shardName)) {
    logger.error('shardName is NOT present in the arguments.');
    usageDemo();
    process.exit(1);
  }
};

// validate and sanitize the input params
validateAndSanitize();

const object = new MigrateDataFromDDbToES({ shard_name: shardName });
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
