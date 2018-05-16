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

    await oThis._validateId();

    await oThis._fetchRecord();

    return oThis._formatApiResponse();
  },

  /**
   * validate id
   *
   * @return {promise<result>}
   */
  _validateId: async function() {
    const oThis = this
    ;

    if (!basicHelper.isUuidValid(oThis.transactionUuid)) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_g_2',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }

    return responseHelper.successWithData({});
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
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_g_3',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }

    // if the record if from another client_id, return error
    if (oThis.clientId != records[0].client_id) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_g_4',
        api_error_identifier: 'data_not_found',
        debug_options: {}
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
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_g_5',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }

    apiResponseData.transaction = transactionEntityFormatterRsp.data;

    return responseHelper.successWithData(apiResponseData);
  }
};

module.exports = GetTransactionsService;