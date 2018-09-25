'use strict';
/**
 * Entry point for AWS Lambda Service
 *
 * @module elasticsearch/lambda
 */

const rootPrefix = '.',
  logger = require(rootPrefix + '/providers/logger'),
  esServices = require(rootPrefix + '/services/es_services/manifest'),
  transactionLogService = require(rootPrefix + '/services/transaction_log/service'),
  responseHelper = require(rootPrefix + '/providers/responseHelper'),
  BulkService = esServices.BulkService;

const Executor = function(records) {
  const oThis = this;
  oThis.records = records;
  oThis.bulkService = new BulkService();
};

Executor.prototype = {
  constructor: Executor,
  bulkService: null,
  populateBulkService: function(record) {
    const oThis = this;

    let service = oThis.getService(record.eventSourceARN);
    if (!service) {
      logger.error('Unable to indentify service for record:\n', record);
      return;
    }

    let data = record.dynamodb.NewImage,
      eventName = record.eventName;

    data = data || {};
    let keys = record.dynamodb.Keys;
    data = Object.assign({}, keys, data);

    return service.populateBulkService(eventName, data, oThis.bulkService);
  },
  getService: function(eventSourceARN) {
    const oThis = this;

    if (eventSourceARN.indexOf('transaction_logs_shard') > 0) {
      return transactionLogService;
    }

    return null;
  },
  perform: async function() {
    const oThis = this;

    let records = oThis.records,
      len = records.length,
      cnt,
      record;

    for (cnt = 0; cnt < len; cnt++) {
      await oThis.populateBulkService(records[cnt]);
    }
    return oThis.bulkService.perform();
  }
};

exports.handler = async (event, context, callback) => {
  let executor = new Executor(event.Records);
  let response = await executor.perform();
  if (response.isFailure()) {
    callback(JSON.stringify(response.toHash()));
  } else {
    callback(null, JSON.stringify(response.toHash()));
  }
};
