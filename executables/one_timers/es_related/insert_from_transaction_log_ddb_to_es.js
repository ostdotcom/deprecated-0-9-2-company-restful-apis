const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  manifest = require(rootPrefix + '/lib/elasticsearch/manifest'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

require(rootPrefix + '/lib/providers/storage');

const args = process.argv,
  config_file_path = args[2],
  configStrategy = require(config_file_path),
  instanceComposer = new InstanceComposer(configStrategy),
  storageProvider = instanceComposer.getStorageProvider(),
  openSTStorage = storageProvider.getInstance(),
  ddbServiceObj = openSTStorage.dynamoDBService;

const eventName = 'INSERT';

function InsertESTransactionLog(params) {
  const oThis = this;
}

InsertESTransactionLog.prototype = {
  queryParams: {
    RequestItems: {}
  },

  insertRecordsInES: function(tableName, recordIds) {
    const oThis = this,
      queryParams = oThis.getQueryParams(tableName, recordIds);
    if (!queryParams) return false;
    ddbServiceObj
      .batchGetItem(queryParams)
      .then(function(response) {
        const oThis = this,
          data = response && response.data,
          dataResponse = data && data.Responses,
          records = dataResponse && dataResponse[tableName];
        if (!records || records.length == 0) {
          logger.error('ERROR - no records found for ids - ' + recordIds.join() + ' in dynamo DB');
          logger.debug('Dynamo DB response', response);
          return false;
        }
        manifest.services.transactionLog
          .bulk(eventName, records)
          .then(function(response) {
            logger.win('Success - records update in ES.');
            logger.debug('Success - records update in ES.', response);
          })
          .catch(function(error) {
            logger.error('Failed - records update in ES.', error);
          });
      })
      .catch(function(error) {
        logger.error('ERROR - failed to get data from dynamo DB', error);
      });
  },

  getQueryParams: function(tableName, recordIds) {
    const oThis = this;
    let queryParams = oThis.queryParams,
      requestItems = queryParams['RequestItems'],
      len = recordIds && recordIds.length,
      cnt,
      keyIds = [];
    if (!len) return false;
    for (cnt = 0; cnt < len; cnt++) {
      keyIds.push({
        txu: {
          S: recordIds[cnt]
        }
      });
    }
    requestItems[tableName] = { Keys: keyIds };
    return queryParams;
  }
};

//Eg:
// const insertObj = new InsertESTransactionLog();
// insertObj.insertRecordsInES( "s_sb_transaction_logs_shard_001" , ["465hjghj4654" , "6876gfg78bjhghj"]);

module.exports = InsertESTransactionLog;
