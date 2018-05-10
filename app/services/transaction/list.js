"use strict";

/**
 * Service to List Transactions
 *
 * @module app/services/transaction/list
 */

const rootPrefix = '../../..'
  , transactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
  , TransactionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/transaction')
;

/**
 * @constructor
 *
 * @param {object} params - service params
 * @param {number} params.client_id (mandatory) - client id
 * @param {number} params.page_no (optional) - page number (starts from 1)
 * @param {string} params.order_by (optional) - order the list by 'created' (default)
 * @param {string} params.order (optional) - order list in 'desc' (default) or 'asc' order.
 * @param {number} params.limit (optional) - Min 1, Max 100, Default 10.
 */
const ListTransactionsService = function (params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
  oThis.pageNo = params.page_no;
  oThis.orderBy = params.order_by;
  oThis.order = params.order;
  oThis.limit = params.limit;

  oThis.offset = null;
  oThis.listRecords = null;
};

ListTransactionsService.prototype = {
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
            internal_error_identifier: 's_t_l_1',
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

    await oThis._fetchRecords();

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

    if ((oThis.pageNo && oThis.pageNo < 1) || oThis.pageNo == 0) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 'xxxxx',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_page_no'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    // default page is 1
    oThis.pageNo = oThis.pageNo || 1;

    // only possible value for order by is created
    if (oThis.orderBy && (oThis.orderBy.toLowerCase() != 'created')) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 'xxxxx',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_order_by'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.orderBy = oThis.orderBy || 'created';
    oThis.orderBy = oThis.orderBy.toLowerCase();
    if (oThis.orderBy == 'created') oThis.orderBy = 'created_by';

    if (oThis.order && !commonValidator.isValidOrderingString(oThis.order)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 'xxxxx',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_order'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.order = oThis.order || 'desc';
    oThis.order = oThis.order.toLowerCase();

    if ((oThis.limit && (oThis.limit < 1 || oThis.limit > 100)) || oThis.limit == 0) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 'xxxxx',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_pagination_limit'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.limit = oThis.limit || 10;
    oThis.offset = (oThis.page_no - 1) * oThis.limit;
  },

  /**
   * Validate and sanitize
   *
   * Sets oThis.listRecords
   *
   * @return {promise<result>}
   */
  _fetchRecords: async function () {
    const oThis = this
    ;

    oThis.listRecords = await new transactionLogModel().getList(oThis.clientId,
      oThis.limit, oThis.offset, oThis.orderBy, oThis.order);

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate and sanitize
   *
   * Sets oThis.listRecords
   *
   * @return {promise<result>}
   */
  _formatApiResponse: async function () {
    const oThis = this
    ;

    let apiResponseData = {
      result_type: 'transactions',
      transactions: []
    };

    for (var i = 0; i < oThis.listRecords.length; i++) {
      let dbRecord = oThis.listRecords[i];

      let transactionEntityFormatter = new TransactionEntityFormatterKlass(dbRecord)
        , transactionEntityFormatterRsp = await transactionEntityFormatter.perform()
      ;

      if (transactionEntityFormatterRsp.isFailure()) continue;

      apiResponseData.transactions.push(transactionEntityFormatterRsp.data);
    }

    return responseHelper.successWithData(apiResponseData);
  }


};

module.exports = ListTransactionsService;