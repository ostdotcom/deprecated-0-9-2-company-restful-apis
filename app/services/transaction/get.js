'use strict';

/**
 * Service to List Transactions
 *
 * @module app/services/transaction/get
 */

const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic');

require(rootPrefix + '/app/models/transaction_log');

/**
 * @constructor
 *
 * @param {object} params - service params
 * @param {number} params.client_id (mandatory) - client id
 * @param {number} params.id (mandatory) - uuid of the transaction
 */
const GetTransactionsService = function(params) {
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.transactionUuid = params.id;
};

GetTransactionsService.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
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
          internal_error_identifier: 's_t_g_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * Async perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this;

    await oThis._validateId();

    return oThis._fetchRecord();
  },

  /**
   * validate id
   *
   * @return {promise<result>}
   */
  _validateId: async function() {
    const oThis = this;

    if (!basicHelper.isUuidValid(oThis.transactionUuid)) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_g_2',
          api_error_identifier: 'data_not_found',
          debug_options: {}
        })
      );
    }

    return responseHelper.successWithData({});
  },

  /**
   * Fetch record
   *
   * Fetches and returns transaction log record
   *
   * @return {promise<result>}
   */
  _fetchRecord: async function() {
    const oThis = this,
      transactionLogModel = oThis.ic().getTransactionLogModel();

    let transactionFetchResponse = await new transactionLogModel({
      client_id: oThis.clientId,
      shard_name: oThis.ic().configStrategy.TRANSACTION_LOG_SHARD_NAME
    }).batchGetItem([oThis.transactionUuid]);

    let transactionLogData = transactionFetchResponse.data[oThis.transactionUuid];

    // if no records found, return error.
    if (!transactionLogData) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_g_3',
          api_error_identifier: 'data_not_found',
          debug_options: {}
        })
      );
    }

    // if the record if from another client_id, return error
    if (oThis.clientId != transactionLogData.client_id) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_g_4',
          api_error_identifier: 'data_not_found',
          debug_options: {}
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData(transactionLogData));
  }
};

InstanceComposer.registerShadowableClass(GetTransactionsService, 'getGetTransactionsService');

module.exports = GetTransactionsService;
