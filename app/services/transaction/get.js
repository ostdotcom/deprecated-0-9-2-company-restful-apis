"use strict";

/**
 * Service to List Transactions
 *
 * @module app/services/transaction/get
 */

const rootPrefix = '../../..'
  , transactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , TransactionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/transaction')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

/**
 * @constructor
 *
 * @param {object} params - service params
 * @param {number} params.client_id (mandatory) - client id
 * @param {number} params.id (mandatory) - uuid of the transaction
 */
const GetTransactionsService = function (params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
  oThis.transactionUuid = params.id;

  oThis.record = null;
};

GetTransactionsService.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function () {
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function (error) {
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
  asyncPerform: async function () {
    const oThis = this
    ;

    await oThis._validateAndSanitize();

    await oThis._fetchRecord();

    return oThis._formatApiResponse();
  },

  /**
   * Validate and sanitize
   *
   * @return {promise<result>}
   */
  _validateAndSanitize: function () {
    const oThis = this
    ;

    return basicHelper.isUuidValid(oThis.transactionUuid) ?
      responseHelper.successWithData({}) :
      Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 'xxxxx',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id_transaction_get'],
        debug_options: {clientId: oThis.clientId, id: oThis.transactionUuid}
      }));
  },

  /**
   * Fetch record
   *
   * Sets oThis.record
   *
   * @return {promise<result>}
   */
  _fetchRecord: async function () {
    const oThis = this
    ;

    let records = await new transactionLogModel().getByTransactionUuid([oThis.transactionUuid]);

    // if no records found, return error.
    if (!records[0]) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 'xxxxx',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id_transaction_get'],
        debug_options: {clientId: oThis.clientId, id: oThis.transactionUuid}
      }));
    }

    // if the record if from another client_id, return error
    if (oThis.clientId != records[0].client_id) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 'xxxxx',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id_transaction_get'],
        debug_options: {clientId: oThis.clientId, id: oThis.transactionUuid}
      }));
    }

    oThis.record = records[0];

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Format api response
   *
   * @return {promise<result>}
   */
  _formatApiResponse: async function () {
    const oThis = this
    ;

    let apiResponseData = {
      result_type: 'transaction'
    };

    let transactionEntityFormatter = new TransactionEntityFormatterKlass(oThis.record)
      , transactionEntityFormatterRsp = await transactionEntityFormatter.perform()
    ;

    if (transactionEntityFormatterRsp.isFailure()) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 'xxxxx',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id_transaction_get'],
        debug_options: {clientId: oThis.clientId, id: oThis.transactionUuid}
      }));
    }

    apiResponseData.transaction = transactionEntityFormatterRsp.data;

    return responseHelper.successWithData(apiResponseData);
  }
};

module.exports = GetTransactionsService;