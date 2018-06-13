"use strict";

/**
 * Service to List STP Transfers
 *
 * @module app/services/stp_transfer/list
 */

const OSTStorage = require('@openstfoundation/openst-storage');

const rootPrefix = '../../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , elasticSearchLibManifest = require(rootPrefix +  '/lib/elasticsearch/manifest')
  , esSearchServiceObject = elasticSearchLibManifest.services.transactionLog
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , transactionLogModel = require(rootPrefix + '/app/models/transaction_log')
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
  oThis.transferUuids = [];
  oThis.offset = null;
  oThis.hasNextPage = null;

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

    await oThis._getFilteredUuids();

    let getDataFromDdbRsp = await oThis._getDataForUuids();
    let nextPagePayload = oThis.hasNextPage ? oThis._getNextPagePayload() : {};

    return Promise.resolve(responseHelper.successWithData({
      result_type: 'transfers',
      transactionLogDDbRecords: getDataFromDdbRsp.data,
      transferUuids: oThis.transferUuids,
      meta: {next_page_payload: nextPagePayload}
    }));

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
   * Get transaction UUID's
   *
   * @return {Promise}
   */
  _getFilteredUuids: async function () {
    const oThis = this
    ;

    // https://www.elastic.co/guide/en/elasticsearch/guide/current/bool-query.html
    let boolFilters = [
      {"term": {"client_id": oThis.clientId}}, // filter by client id
      {"term": {"type": new transactionLogModel().invertedTransactionTypes[transactionLogConst.stpTransferTransactionType]}} // filter by transaction type
    ];

    // if transaction_uuids are passes in params, add filter on it
    if (oThis.idsFilterArr.length > 0) {
      boolFilters.push({"terms": { "id" : oThis.idsFilterArr }});
    }

    let sortParams = {};
    if (oThis.orderBy === 'created') {sortParams['created_at'] = oThis.order}

    let filteringParams = {
      "query": {
        "bool": {"filter": boolFilters}
      },
      "from" : oThis.offset,
      "size" : oThis.limit,
      "sort": [sortParams]
    };

    let searchRsp = await esSearchServiceObject.search(filteringParams);
    if(searchRsp.isFailure()) {return Promise.reject(searchRsp)}

    let searchData = searchRsp.data
      , meta = searchData.meta
      , transaction_logs = searchData.transaction_logs
      , transfer_uuids = []
    ;

    for(let i=0; i<transaction_logs.length; i++) {
      transfer_uuids.push(transaction_logs[i].id);
    }

    oThis.transferUuids = transfer_uuids;
    oThis.hasNextPage = meta.has_next_page ;

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * get next page payload
   *
   * @return {object}
   */
  _getNextPagePayload: function () {

    const oThis = this;

    let payload = {
      order_by: oThis.orderBy,
      order: oThis.order,
      page_no: oThis.pageNo + 1,
      limit: oThis.limit
    };

    if(oThis.idsFilterStr) {payload['id'] = oThis.idsFilterStr}

    return payload;

  },

  /**
   * For shortlisted UUID's, fetch data from DDB
   *
   * @return {promise<result>}
   */
  _getDataForUuids: async function () {
    const oThis = this
    ;

    let transactionResponse = await new OSTStorage.TransactionLogModel({
      client_id: oThis.clientId,
      ddb_service: ddbServiceObj
    }).batchGetItem(oThis.transferUuids);

    if (!transactionResponse.data) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stp_l_6',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }

    return Promise.resolve(responseHelper.successWithData(transactionResponse.data));

  }

};

module.exports = ListStpTransfersService;