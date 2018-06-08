"use strict";

/**
 * Service to List STP Transfers
 *
 * @module app/services/stp_transfer/list
 */

const OSTStorage = require('@openstfoundation/openst-storage');

const rootPrefix = '../../..'
  , transactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , StpTransferEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/stp_transfer')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
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
 * @param {string} params.id (optional) - comma separated ids to filter
 */
const ListStpTransfersService = function (params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
  oThis.pageNo = params.page_no;
  oThis.orderBy = params.order_by;
  oThis.order = params.order;
  oThis.limit = params.limit;
  oThis.idsFilterStr = params.id;

  oThis.idsFilterArr = [];
  oThis.orderByForQuery = null;
  oThis.offset = null;
  oThis.listRecords = null;
};

ListStpTransfersService.prototype = {
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
            internal_error_identifier: 's_stp_l_1',
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

    let pageNoVas = commonValidator.validateAndSanitizePageNo(oThis.pageNo);

    if(!pageNoVas[0]) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_stp_l_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_page_no'],
        debug_options: {}
      }));
    }
    oThis.pageNo = pageNoVas[1];

    let limitVas = commonValidator.validateAndSanitizeLimit(oThis.limit);

    if(!limitVas[0]) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_stp_l_3',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_pagination_limit'],
        debug_options: {}
      }));
    }
    oThis.limit = limitVas[1];

    oThis.offset = (oThis.pageNo - 1) * oThis.limit;

    // only possible value for order by is created
    if (oThis.orderBy && (oThis.orderBy.toLowerCase() != 'created')) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_stp_l_4',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_order_by'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.orderBy = oThis.orderBy || 'created';
    oThis.orderBy = oThis.orderBy.toLowerCase();

    if (oThis.orderBy == 'created') oThis.orderByForQuery = 'id';

    if (oThis.order && !commonValidator.isValidOrderingString(oThis.order)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_stp_l_5',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_order'],
        debug_options: {clientId: oThis.clientId}
      }));
    }

    oThis.order = oThis.order || 'desc';
    oThis.order = oThis.order.toLowerCase();

    if (oThis.idsFilterStr && oThis.idsFilterStr.length > 0) {
      oThis.idsFilterArr = basicHelper.commaSeperatedStrToArray(oThis.idsFilterStr);
      if (oThis.idsFilterArr.length > 100) {
        return Promise.reject(responseHelper.paramValidationError({
          internal_error_identifier: 's_stp_l_6',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_id_filter'],
          debug_options: {clientId: oThis.clientId}
        }));
      }
    }

    return responseHelper.successWithData({});
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

    /*
    oThis.listRecords = await new transactionLogModel().getList(
      oThis.clientId,
      transactionLogConst.stpTransferTransactionType,
      {limit: oThis.limit + 1, offset: oThis.offset, orderBy: oThis.orderByForQuery, order: oThis.order},
      {id: oThis.idsFilterArr}
    ); */

    oThis.uuids = [];

    //TODO: Call ES library method with appropriate params to get the uuids

    let transactionResponse = new OSTStorage.TransactionLogModel({
      client_id: oThis.clientId,
      ddb_service: ddbServiceObj
    }).batchGetItem(oThis.uuids);

    if (!transactionResponse.data) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stp_l_6',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }

    for (let key in transactionResponse.data) {
      let record = transactionResponse.data[key];
      oThis.listRecords.push(record);
    }

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
      result_type: 'transfers',
      transfers: [],
      meta: {
        next_page_payload: {}
      }
    };

    let hasMore = false;

    for (var i = 0; i < oThis.listRecords.length; i++) {
      let dbRecord = oThis.listRecords[i];

      if (i == oThis.limit) {
        // as we fetched limit + 1, ignore that extra one
        hasMore = true;
        continue;
      }

      let stpTransferEntityFormatter = new StpTransferEntityFormatterKlass(dbRecord)
        , stpTransferEntityFormatterRsp = await stpTransferEntityFormatter.perform()
      ;

      if (stpTransferEntityFormatterRsp.isFailure()) continue;

      apiResponseData.transfers.push(stpTransferEntityFormatterRsp.data);
    }

    if (hasMore) {
      let nextPagePayload = {
        order_by: oThis.orderBy,
        order: oThis.order,
        limit: oThis.limit,
        page_no: oThis.pageNo + 1
      };

      if (oThis.idsFilterStr && oThis.idsFilterStr.length > 0) {
        nextPagePayload.id = oThis.idsFilterStr;
      }

      apiResponseData.meta.next_page_payload = nextPagePayload;
    }

    return responseHelper.successWithData(apiResponseData);
  }

};

module.exports = ListStpTransfersService;