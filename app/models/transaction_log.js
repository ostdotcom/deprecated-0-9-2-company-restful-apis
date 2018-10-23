/**
 * Transaction Log Model
 *
 * @module lib/models/transaction_log
 *
 */

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  BigNumber = require('bignumber.js'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/storage');
require(rootPrefix + '/lib/cache_multi_management/transaction_log');

const longToShortNamesMap = {
    transaction_hash: 'txh',
    transaction_uuid: 'txu',
    transaction_type: 'tt',
    block_number: 'bn',
    client_id: 'ci',
    client_token_id: 'cti',
    gas_used: 'gu',
    gas_price: 'gp',
    status: 's',
    created_at: 'ca',
    updated_at: 'ua',
    from_uuid: 'fu',
    to_uuid: 'tu',
    action_id: 'ai',
    token_symbol: 'ts',
    post_receipt_process_params: 'prpp',
    commission_amount_in_wei: 'caiw',
    commission_percent: 'cp',
    amount_in_wei: 'aiw',
    amount: 'a',
    airdrop_amount_in_wei: 'amiw',
    to_address: 'ta',
    from_address: 'fa',
    transfer_events: 'te',
    error_code: 'ec',
    nonce: 'nn',
    transaction_executor_address: 'tea',
    raw_transaction: 'rt'
  },
  shortToLongNamesMap = util.invert(longToShortNamesMap);

/**
 * Transaction Log Model
 *
 * @constructor
 */
const TransactionLogModel = function(params) {
  const oThis = this,
    storageProvider = oThis.ic().getStorageProvider(),
    openSTStorage = storageProvider.getInstance();

  oThis.clientId = params.client_id;
  oThis.shardName = params.shard_name;
  oThis.ddbServiceObj = openSTStorage.dynamoDBService;

  oThis.tableSchema = oThis.getTableSchema(oThis.shardName);

  oThis.shardHelper = new openSTStorage.model.ShardHelper({
    table_schema: oThis.tableSchema,
    shard_name: oThis.shardName
  });
};

const transactionLogModelSpecificPrototype = {
  /**
   * Create and register shard
   *
   * @return {promise<result>}
   */
  createShard: function() {
    const oThis = this;

    return oThis.shardHelper.createShard();
  },

  /**
   * Handles logic of shorting input param keys
   *
   * @private
   * @param longName - long name of key
   *
   * @return {String}
   */
  shortNameFor: function(longName) {
    const oThis = this;

    return longToShortNamesMap[longName];
  },

  /**
   * Handles logic of shorting input param keys
   *
   * @private
   * @param shortName - short name of key
   *
   * @return {String}
   */
  longNameFor: function(shortName) {
    const oThis = this;

    return shortToLongNamesMap[shortName];
  },

  /**
   * Create table params
   *
   * @return {object}
   */
  getTableSchema: function(shardName) {
    // This method is used in base class
    const oThis = this;

    const tableSchema = {
      TableName: shardName,
      KeySchema: [
        {
          AttributeName: oThis.shortNameFor('transaction_uuid'),
          KeyType: 'HASH'
        }
      ],
      AttributeDefinitions: [{ AttributeName: oThis.shortNameFor('transaction_uuid'), AttributeType: 'S' }],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      },
      SSESpecification: {
        Enabled: false
      }
    };

    return tableSchema;
  },

  /**
   * NOTE: This would override the existing document (if any) with the keys being passed
   * bulk create / update items in DDB
   *
   * @params {array} rawData
   * @params {Integer} unprocessedItemsRetryCount - Retry count for unprocessed Items
   *
   * @return {promise<result>}
   */
  batchPutItem: async function(rawData, unprocessedItemsRetryCount) {
    const oThis = this,
      batchPutLimit = 25,
      parallelPromisesCount = 15;

    if (!unprocessedItemsRetryCount) {
      unprocessedItemsRetryCount = 0;
    }

    if (!oThis.shardName) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_m_tl_bpi_1',
          api_error_identifier: 'invalid_shard_name',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    let dataBatchNo = 1,
      formattedErrorCount = 1,
      allPromisesData = [],
      transactionUuids = [];

    while (true) {
      const offset = (dataBatchNo - 1) * batchPutLimit,
        batchedrawData = rawData.slice(offset, batchPutLimit + offset),
        batchedFormattedData = [];

      for (let i = 0; i < batchedrawData.length; i++) {
        let rowData = batchedrawData[i];
        transactionUuids.push(rowData['transaction_uuid']);
        batchedFormattedData.push({
          PutRequest: {
            Item: oThis._formatDataForPutItem(rowData)
          }
        });
      }

      if (batchedrawData.length > 0) {
        let batchPutParams = { RequestItems: {} };
        batchPutParams.RequestItems[oThis.shardName] = batchedFormattedData;

        allPromisesData.push(batchPutParams);
      }

      if (
        allPromisesData.length == parallelPromisesCount ||
        (batchedrawData.length == 0 && allPromisesData.length > 0)
      ) {
        logger.info(`batchPutItem clientId : ${oThis.clientId} batch : ${dataBatchNo}`);

        let batchedPromisesData = [];

        for (let i = 0; i < allPromisesData.length; i++) {
          // retry count is set to 10 as of now
          batchedPromisesData.push(oThis.ddbServiceObj.batchWriteItem(allPromisesData[i], unprocessedItemsRetryCount));
        }

        let promiseResponses = await Promise.all(batchedPromisesData);

        for (let i = 0; i < promiseResponses.length; i++) {
          if (promiseResponses[i].isFailure()) {
            logger.error(
              `error batchPutItem clientId : ${
                oThis.clientId
              } batch : ${formattedErrorCount} error : ${promiseResponses[i].toHash()}`
            );
            return Promise.reject(promiseResponses[i]);
          } else {
            let unprocessedItems = promiseResponses[i].data.UnprocessedItems;
            if (Object.keys(unprocessedItems).length > 0) {
              logger.error(
                `error batchPutItem clientId : ${oThis.clientId} batch : ${formattedErrorCount} unprocessedItems : ${
                  unprocessedItems[oThis.shardName].length
                }`
              );
              return Promise.reject(
                responseHelper.error({
                  internal_error_identifier: 'l_m_tl_bpi_2',
                  api_error_identifier: 'ddb_batch_write_failed',
                  debug_options: {
                    unProcessedCount: unprocessedItems[oThis.shardName].length
                    //, unProcessedItems: unprocessedItems[oThis.shardName]
                  },
                  error_config: errorConfig
                })
              );
            }
          }
          formattedErrorCount += 1;
        }

        // empty the batch promise data
        allPromisesData = [];
      }

      dataBatchNo = dataBatchNo + 1;

      if (batchedrawData.length === 0) break;
    }

    //TODO: We can consider optimizing, by only flushing for uuids which were successfully updated
    let transactionLogCache = oThis.ic().getTransactionLogCache();
    // not intentionally waiting for cache flush to happen
    new transactionLogCache({
      uuids: transactionUuids,
      client_id: oThis.clientId
    }).clear();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * batch get items from DDB
   *
   * @params {array} uuidsToFetch
   * @params {Integer} unprocessedKeysRetryCount - Retry count for unprocessed Keys
   *
   * @return {promise<result>}
   */
  batchGetItem: async function(uuidsToFetch, unprocessedKeysRetryCount, fieldsToFetch) {
    const oThis = this;

    if (!unprocessedKeysRetryCount) {
      unprocessedKeysRetryCount = 0;
    }

    if (!oThis.shardName) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_m_tl_bgi_1',
          api_error_identifier: 'invalid_shard_name',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    let getKeys = [],
      shortNameForTxUuid = oThis.shortNameFor('transaction_uuid');

    for (let i = 0; i < uuidsToFetch.length; i++) {
      let buffer = {};
      buffer[shortNameForTxUuid] = { S: uuidsToFetch[i] };
      getKeys.push(buffer);
    }

    let bachGetParams = { RequestItems: {} };
    bachGetParams.RequestItems[oThis.shardName] = { Keys: getKeys, ConsistentRead: true };

    if (fieldsToFetch) {
      let projectionExpressionArr = [];

      for (var i = 0; i < fieldsToFetch.length; i++) {
        let shortFieldName = oThis.shortNameFor(fieldsToFetch[i]);
        if (!shortFieldName) continue;

        projectionExpressionArr.push(shortFieldName);
      }

      if (projectionExpressionArr.length > 0) {
        //transaction_uuid is mandatory to have in fetch list.
        if (projectionExpressionArr.indexOf(shortNameForTxUuid) == -1) {
          projectionExpressionArr.push(shortNameForTxUuid);
        }
        let projectionExpression = projectionExpressionArr.join(',');

        bachGetParams.RequestItems[oThis.shardName]['ProjectionExpression'] = projectionExpression;
      }
    }

    let batchGetRsp = await oThis.ddbServiceObj.batchGetItem(bachGetParams, unprocessedKeysRetryCount);

    if (batchGetRsp.isFailure()) {
      return Promise.reject(batchGetRsp);
    }

    let unprocessedKeys = batchGetRsp.data.UnprocessedKeys;
    if (Object.keys(unprocessedKeys).length > 0) {
      let unprocessedKeysLength = unprocessedKeys[oThis.shardName]['Keys'].length;
      logger.error(`batchGetItem clientId : ${oThis.clientId} UnprocessedKeys : ${unprocessedKeysLength}`);
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_m_tl_2',
          api_error_identifier: 'ddb_batch_get_failed',
          debug_options: { unProcessedCount: unprocessedKeysLength },
          error_config: errorConfig
        })
      );
    }

    let dbRows = batchGetRsp.data.Responses[oThis.shardName],
      formattedDbRows = {};

    for (let i = 0; i < dbRows.length; i++) {
      let formattedDbRow = oThis._formatDataForGetItem(dbRows[i]);
      formattedDbRows[formattedDbRow['transaction_uuid']] = formattedDbRow;
    }

    return Promise.resolve(responseHelper.successWithData(formattedDbRows));
  },

  /**
   * Update given items of transaction log record.
   *
   * @params {Object} dataToUpdate - data to be updated in DB
   * @params {Boolean} flushCache - boolean which governs if flush cache is required
   *
   * @return {promise<result>}
   */
  updateItem: async function(dataToUpdate, flushCache) {
    const oThis = this,
      expressionAttributeValues = {},
      updateExpression = [];

    if (commonValidator.isVarNull(flushCache)) {
      flushCache = true;
    }

    const keyObj = oThis._keyObj({ transaction_uuid: dataToUpdate['transaction_uuid'] });
    const updateData = oThis._formatDataForPutItem(dataToUpdate);

    for (var i in updateData) {
      if (keyObj[i]) continue;

      expressionAttributeValues[':' + i] = updateData[i];
      updateExpression.push(i + '=:' + i);
    }

    if (updateExpression.length == 0) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'm_tb_set_1',
          api_error_identifier: 'invalid_balance',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    if (!oThis.shardName) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_m_tl_ui_1',
          api_error_identifier: 'invalid_shard_name',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    const txLogsParams = {
      TableName: oThis.shardName,
      Key: oThis._keyObj({ transaction_uuid: dataToUpdate['transaction_uuid'] }),
      UpdateExpression: 'SET ' + updateExpression.join(','),
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'NONE'
    };

    const updateResponse = await oThis.ddbServiceObj.updateItem(txLogsParams, 10);

    if (updateResponse.isFailure()) {
      return updateResponse;
    }

    if (flushCache) {
      let transactionLogCache = oThis.ic().getTransactionLogCache();
      // not intentionally waiting for cache flush to happen
      new transactionLogCache({
        uuids: [dataToUpdate['transaction_uuid']],
        client_id: oThis.clientId
      }).clear();
    }

    return Promise.resolve(updateResponse);
  },

  /**
   * Primary key of the table.
   *
   * @return {object}
   */
  _keyObj: function(params) {
    const oThis = this,
      keyObj = {};

    keyObj[oThis.shortNameFor('transaction_uuid')] = { S: params['transaction_uuid'].toLowerCase() };

    return keyObj;
  },

  /**
   * NOTE: Only send keys which are to be inserted in DB. DO NOT send keys with null values
   * Format data for putItem
   *
   * @return {object}
   */
  _formatDataForPutItem: function(rowData) {
    const oThis = this;

    let formattedRowData = oThis._keyObj(rowData);

    if (rowData.hasOwnProperty('transaction_hash')) {
      formattedRowData[oThis.shortNameFor('transaction_hash')] = { S: rowData['transaction_hash'].toLowerCase() };
    }

    if (rowData.hasOwnProperty('block_number')) {
      formattedRowData[oThis.shortNameFor('block_number')] = { N: rowData['block_number'].toString() };
    }

    if (rowData.hasOwnProperty('transaction_type')) {
      formattedRowData[oThis.shortNameFor('transaction_type')] = { N: rowData['transaction_type'].toString() };
    }

    if (rowData.hasOwnProperty('client_id')) {
      formattedRowData[oThis.shortNameFor('client_id')] = { N: rowData['client_id'].toString() };
    }

    if (rowData.hasOwnProperty('client_token_id')) {
      formattedRowData[oThis.shortNameFor('client_token_id')] = { N: rowData['client_token_id'].toString() };
    }

    if (rowData.hasOwnProperty('gas_used')) {
      formattedRowData[oThis.shortNameFor('gas_used')] = { N: rowData['gas_used'].toString() };
    }

    if (rowData.hasOwnProperty('gas_price')) {
      formattedRowData[oThis.shortNameFor('gas_price')] = { N: rowData['gas_price'].toString() };
    }

    if (rowData.hasOwnProperty('status')) {
      formattedRowData[oThis.shortNameFor('status')] = { N: rowData['status'].toString() };
    }

    if (rowData.hasOwnProperty('created_at')) {
      formattedRowData[oThis.shortNameFor('created_at')] = { N: rowData['created_at'].toString() };
    }

    if (rowData.hasOwnProperty('updated_at')) {
      formattedRowData[oThis.shortNameFor('updated_at')] = { N: rowData['updated_at'].toString() };
    }

    if (rowData.hasOwnProperty('from_uuid')) {
      formattedRowData[oThis.shortNameFor('from_uuid')] = { S: rowData['from_uuid'] };
    }

    if (rowData.hasOwnProperty('to_uuid')) {
      formattedRowData[oThis.shortNameFor('to_uuid')] = { S: rowData['to_uuid'] };
    }

    if (rowData.hasOwnProperty('action_id')) {
      formattedRowData[oThis.shortNameFor('action_id')] = { N: rowData['action_id'].toString() };
    }

    if (rowData.hasOwnProperty('commission_amount_in_wei')) {
      formattedRowData[oThis.shortNameFor('commission_amount_in_wei')] = {
        N: rowData['commission_amount_in_wei'].toString()
      };
    }

    if (rowData.hasOwnProperty('commission_percent') && !isNaN(parseFloat(rowData['commission_percent']))) {
      formattedRowData[oThis.shortNameFor('commission_percent')] = { N: rowData['commission_percent'].toString() };
    }

    if (rowData.hasOwnProperty('amount_in_wei')) {
      formattedRowData[oThis.shortNameFor('amount_in_wei')] = { N: rowData['amount_in_wei'].toString() };
    }

    if (rowData.hasOwnProperty('airdrop_amount_in_wei') && rowData['airdrop_amount_in_wei'] != null) {
      formattedRowData[oThis.shortNameFor('airdrop_amount_in_wei')] = {
        N: rowData['airdrop_amount_in_wei'].toString()
      };
    }

    if (rowData.hasOwnProperty('amount') && rowData['amount'] != null) {
      formattedRowData[oThis.shortNameFor('amount')] = { N: rowData['amount'].toString() };
    }

    if (rowData.hasOwnProperty('token_symbol')) {
      formattedRowData[oThis.shortNameFor('token_symbol')] = { S: rowData['token_symbol'] };
    }

    if (rowData.hasOwnProperty('to_address')) {
      formattedRowData[oThis.shortNameFor('to_address')] = { S: rowData['to_address'] };
    }

    if (rowData.hasOwnProperty('from_address')) {
      formattedRowData[oThis.shortNameFor('from_address')] = { S: rowData['from_address'] };
    }

    if (rowData.hasOwnProperty('error_code')) {
      formattedRowData[oThis.shortNameFor('error_code')] = { S: rowData['error_code'] };
    }

    if (rowData.hasOwnProperty('post_receipt_process_params')) {
      formattedRowData[oThis.shortNameFor('post_receipt_process_params')] = {
        S: JSON.stringify(rowData['post_receipt_process_params'] || {})
      };
    }

    if (rowData.hasOwnProperty('transfer_events')) {
      let formattedEventsData = [];
      for (var j = 0; j < rowData['transfer_events'].length; j++) {
        let event_data = rowData['transfer_events'][j],
          formattedEventData = {};
        if (event_data.hasOwnProperty('from_uuid')) {
          formattedEventData[oThis.shortNameFor('from_uuid')] = { S: event_data['from_uuid'] };
        }
        if (event_data.hasOwnProperty('to_uuid')) {
          formattedEventData[oThis.shortNameFor('to_uuid')] = { S: event_data['to_uuid'] };
        }
        formattedEventData[oThis.shortNameFor('from_address')] = { S: event_data['from_address'] };
        formattedEventData[oThis.shortNameFor('to_address')] = { S: event_data['to_address'] };
        formattedEventData[oThis.shortNameFor('amount_in_wei')] = { N: event_data['amount_in_wei'].toString() };
        formattedEventsData.push({ M: formattedEventData });
      }
      formattedRowData[oThis.shortNameFor('transfer_events')] = { L: formattedEventsData };
    }

    if (rowData.hasOwnProperty('nonce')) {
      formattedRowData[oThis.shortNameFor('nonce')] = { N: rowData['nonce'].toString() };
    }

    if (rowData.hasOwnProperty('transaction_executor_address')) {
      formattedRowData[oThis.shortNameFor('transaction_executor_address')] = {
        S: rowData['transaction_executor_address']
      };
    }

    if (rowData.hasOwnProperty('raw_transaction')) {
      formattedRowData[oThis.shortNameFor('raw_transaction')] = {
        S: JSON.stringify(rowData['raw_transaction'] || {})
      };
    }

    return formattedRowData;
  },

  /**
   * Formatted Data from Get Item (this elongates short keys)
   *
   * @return {object}
   */
  _formatDataForGetItem: function(rowData) {
    const oThis = this;

    let formattedRowData = { transaction_uuid: rowData[oThis.shortNameFor('transaction_uuid')]['S'] };

    if (rowData.hasOwnProperty(oThis.shortNameFor('transaction_hash'))) {
      formattedRowData['transaction_hash'] = rowData[oThis.shortNameFor('transaction_hash')]['S'];
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('block_number'))) {
      formattedRowData['block_number'] = parseInt(rowData[oThis.shortNameFor('block_number')]['N']);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('transaction_type'))) {
      formattedRowData['transaction_type'] = parseInt(rowData[oThis.shortNameFor('transaction_type')]['N']);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('client_id'))) {
      formattedRowData['client_id'] = parseInt(rowData[oThis.shortNameFor('client_id')]['N']);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('client_token_id'))) {
      formattedRowData['client_token_id'] = parseInt(rowData[oThis.shortNameFor('client_token_id')]['N']);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('gas_used'))) {
      formattedRowData['gas_used'] = rowData[oThis.shortNameFor('gas_used')]['N'];
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('gas_price'))) {
      formattedRowData['gas_price'] = rowData[oThis.shortNameFor('gas_price')]['N'];
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('status'))) {
      formattedRowData['status'] = parseInt(rowData[oThis.shortNameFor('status')]['N']);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('created_at'))) {
      formattedRowData['created_at'] = parseInt(rowData[oThis.shortNameFor('created_at')]['N']);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('updated_at'))) {
      formattedRowData['updated_at'] = parseInt(rowData[oThis.shortNameFor('updated_at')]['N']);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('from_uuid'))) {
      formattedRowData['from_uuid'] = rowData[oThis.shortNameFor('from_uuid')]['S'];
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('to_uuid'))) {
      formattedRowData['to_uuid'] = rowData[oThis.shortNameFor('to_uuid')]['S'];
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('action_id'))) {
      formattedRowData['action_id'] = parseInt(rowData[oThis.shortNameFor('action_id')]['N']);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('commission_percent'))) {
      formattedRowData['commission_percent'] = parseFloat(rowData[oThis.shortNameFor('commission_percent')]['N']);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('commission_amount_in_wei'))) {
      //formattedRowData['commission_amount_in_wei'] = rowData[oThis.shortNameFor('commission_amount_in_wei')]['N'];
      formattedRowData['commission_amount_in_wei'] = new BigNumber(
        rowData[oThis.shortNameFor('commission_amount_in_wei')]['N']
      ).toString(10);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('amount_in_wei'))) {
      //formattedRowData['amount_in_wei'] = rowData[oThis.shortNameFor('amount_in_wei')]['N'];
      formattedRowData['amount_in_wei'] = new BigNumber(rowData[oThis.shortNameFor('amount_in_wei')]['N']).toString(10);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('airdrop_amount_in_wei'))) {
      //formattedRowData['airdrop_amount_in_wei'] = rowData[oThis.shortNameFor('airdrop_amount_in_wei')]['N'];
      formattedRowData['airdrop_amount_in_wei'] = new BigNumber(
        rowData[oThis.shortNameFor('airdrop_amount_in_wei')]['N']
      ).toString(10);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('amount'))) {
      //formattedRowData['amount'] = rowData[oThis.shortNameFor('amount')]['N'];
      formattedRowData['amount'] = new BigNumber(rowData[oThis.shortNameFor('amount')]['N']).toString(10);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('token_symbol'))) {
      formattedRowData['token_symbol'] = rowData[oThis.shortNameFor('token_symbol')]['S'];
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('to_address'))) {
      formattedRowData['to_address'] = rowData[oThis.shortNameFor('to_address')]['S'];
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('from_address'))) {
      formattedRowData['from_address'] = rowData[oThis.shortNameFor('from_address')]['S'];
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('error_code'))) {
      formattedRowData['error_code'] = rowData[oThis.shortNameFor('error_code')]['S'];
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('post_receipt_process_params'))) {
      formattedRowData['post_receipt_process_params'] = JSON.parse(
        rowData[oThis.shortNameFor('post_receipt_process_params')]['S'] || '{}'
      );
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('raw_transaction'))) {
      formattedRowData['raw_transaction'] = JSON.parse(rowData[oThis.shortNameFor('raw_transaction')]['S'] || '{}');
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('nonce'))) {
      formattedRowData['nonce'] = parseInt(rowData[oThis.shortNameFor('nonce')]['N']);
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('transaction_executor_address'))) {
      formattedRowData['transaction_executor_address'] =
        rowData[oThis.shortNameFor('transaction_executor_address')]['S'];
    }

    if (rowData.hasOwnProperty(oThis.shortNameFor('transfer_events'))) {
      let formattedTransferEventsData = [],
        rawTransferEventsData = rowData[oThis.shortNameFor('transfer_events')]['L'];

      for (let i = 0; i < rawTransferEventsData.length; i++) {
        let buffer = rawTransferEventsData[i]['M'],
          formattedBuffer = {};

        formattedBuffer['from_address'] = buffer[oThis.shortNameFor('from_address')]['S'];
        formattedBuffer['to_address'] = buffer[oThis.shortNameFor('to_address')]['S'];
        //formattedBuffer['amount_in_wei'] = buffer[oThis.shortNameFor('amount_in_wei')]['N'];
        formattedBuffer['amount_in_wei'] = new BigNumber(buffer[oThis.shortNameFor('amount_in_wei')]['N']).toString(10);

        if (buffer.hasOwnProperty(oThis.shortNameFor('from_uuid'))) {
          formattedBuffer['from_uuid'] = buffer[oThis.shortNameFor('from_uuid')]['S'];
        }

        if (buffer.hasOwnProperty(oThis.shortNameFor('to_uuid'))) {
          formattedBuffer['to_uuid'] = buffer[oThis.shortNameFor('to_uuid')]['S'];
        }

        formattedTransferEventsData.push(formattedBuffer);
      }

      formattedRowData['transfer_events'] = formattedTransferEventsData;
    }

    return formattedRowData;
  }
};

Object.assign(TransactionLogModel.prototype, transactionLogModelSpecificPrototype);

InstanceComposer.registerShadowableClass(TransactionLogModel, 'getTransactionLogModel');

module.exports = TransactionLogModel;
