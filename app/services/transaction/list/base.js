'use strict';

const rootPrefix = '../../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log');

require(rootPrefix + '/lib/cache_multi_management/transaction_log');
require(rootPrefix + '/lib/elasticsearch_saas/search');

const Base = function(params) {
  var oThis = this;

  oThis.clientId = params.client_id;
  oThis.pageNo = params.page_no;
  oThis.orderBy = params.order_by;
  oThis.order = params.order;
  oThis.limit = params.limit;

  oThis.offset = null;
  oThis.hasNextPage = null;
  oThis.transactionUuids = [];
  oThis.filteringParams = {};
};

Base.prototype = {
  /**
   *
   * Perform
   *
   * @return {Promise<result>}
   *
   */
  perform: function() {
    var oThis = this;

    return oThis._asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 's_t_l_b_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * asyncPerform
   *
   * @return {Promise}
   */
  _asyncPerform: async function() {
    var oThis = this;

    await oThis._validateAndSanitize();

    await oThis._getFilteringParams();

    await oThis._getFilteredUuids();

    let getDataFromDdbRsp = await oThis._getDataForUuids();
    let nextPagePayload = oThis.hasNextPage ? oThis._getNextPagePayload() : {};

    return Promise.resolve(
      responseHelper.successWithData({
        result_type: 'transactions',
        transactionLogDDbRecords: getDataFromDdbRsp.data,
        transactionUuids: oThis.transactionUuids,
        meta: { next_page_payload: nextPagePayload }
      })
    );
  },

  /**
   * validate and sanitize
   *
   * @return {Promise}
   */
  _baseValidateAndSanitize: async function() {
    var oThis = this;

    // validate / sanitize page number
    let pageNoVas = commonValidator.validateAndSanitizePageNo(oThis.pageNo);
    if (!pageNoVas[0]) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_l_fci_3',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_page_no'],
          debug_options: {}
        })
      );
    }
    oThis.pageNo = pageNoVas[1];

    // validate / sanitize limit
    let limitVas = commonValidator.validateAndSanitizeLimit(oThis.limit);
    if (!limitVas[0]) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_l_fci_4',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_pagination_limit'],
          debug_options: {}
        })
      );
    }
    oThis.limit = limitVas[1];

    // compute offset
    oThis.offset = (oThis.pageNo - 1) * oThis.limit;

    // validate / sanitize order_by : only possible value for order by is created
    if (oThis.orderBy && oThis.orderBy.toLowerCase() != 'created') {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_l_fci_5',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_order_by'],
          debug_options: { clientId: oThis.clientId }
        })
      );
    }
    oThis.orderBy = oThis.orderBy || 'created';
    oThis.orderBy = oThis.orderBy.toLowerCase();

    // validate / sanitize order :
    if (oThis.order && !commonValidator.isValidOrderingString(oThis.order)) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_l_fci_6',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_order'],
          debug_options: { clientId: oThis.clientId }
        })
      );
    }
    oThis.order = oThis.order || 'desc';
    oThis.order = oThis.order.toLowerCase();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Get transaction UUID's
   *
   * @return {Promise}
   */
  _getFilteredUuids: async function() {
    var oThis = this;

    logger.debug('filteringParams', oThis.filteringParams);

    const EsSearchServiceKlass = oThis.ic().getEsSearchService(),
      esSearchServiceObject = new EsSearchServiceKlass({
        queryBody: oThis.filteringParams,
        requestSource: ['id']
      });

    let searchRsp = await esSearchServiceObject.perform();
    if (searchRsp.isFailure()) {
      return Promise.reject(searchRsp);
    }

    let searchData = searchRsp.data,
      meta = searchData.meta,
      transaction_logs = searchData.transaction_logs,
      transaction_uuids = [];

    for (let i = 0; i < transaction_logs.length; i++) {
      transaction_uuids.push(transaction_logs[i].id);
    }

    oThis.transactionUuids = transaction_uuids;
    oThis.hasNextPage = meta.has_next_page;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * get pagination params for search query
   *
   * @return {object}
   */
  _getPaginationParams: function() {
    var oThis = this;

    let sortParams = {};

    if (oThis.orderBy === 'created') {
      sortParams['created_at'] = oThis.order;
    }

    return {
      from: oThis.offset,
      size: oThis.limit,
      sort: [sortParams]
    };
  },

  /**
   * get common filtering params for search query
   *
   * @return {object}
   */
  _getCommonFilteringParams: function() {
    var oThis = this;
    return [
      { term: { type: transactionLogConst.invertedTransactionTypes[transactionLogConst.tokenTransferTransactionType] } } // filter by transaction type
    ];
  },

  /**
   * Get transaction log data
   *
   * @return {Promise}
   */
  _getDataForUuids: async function() {
    var oThis = this,
      transactionLogData = {};

    if (oThis.transactionUuids.length === 0) {
      return responseHelper.successWithData(transactionLogData);
    }

    let start_time = Date.now();
    const transactionLogCache = oThis.ic().getTransactionLogCache();

    let transactionFetchResponse = await new transactionLogCache({
      client_id: oThis.clientId,
      uuids: oThis.transactionUuids
    }).fetch();

    // if no records found, return error.
    if (!transactionFetchResponse.data) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_l_b_2',
          api_error_identifier: 'data_not_found',
          debug_options: {}
        })
      );
    }

    transactionLogData = transactionFetchResponse.data;

    return responseHelper.successWithData(transactionLogData);
  }
};

InstanceComposer.registerShadowableClass(Base, 'getBaseClass');
module.exports = Base;
