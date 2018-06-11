"use strict";

const OSTStorage = require('@openstfoundation/openst-storage');

const rootPrefix = '../../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , commonValidator = require(rootPrefix +  '/lib/validators/common')
  , elasticSearchLibManifest = require(rootPrefix +  '/lib/elasticsearch/manifest')
  , ddbSearchServiceObject = elasticSearchLibManifest.services.transactionLog
;

const Base = function(params) {
  const oThis = this
  ;

  oThis.pageNo = params.page_no;
  oThis.orderBy = params.order_by;
  oThis.order = params.order;
  oThis.limit = params.limit;

  oThis.offset = null;
  oThis.transactionUuids = [];

};

Base.prototype = {

  /**
   *
   * Perform
   *
   * @return {Promise<result>}
   *
   */
  perform: function () {
    const oThis = this
    ;

    return oThis._asyncPerform()
        .catch(function (error) {
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
    const oThis = this
    ;

    await oThis._validateAndSanitize();

    await oThis._getFilteredUuids(oThis._getFilteringParams());

    return oThis._getDataForUuids();

  },

  /**
   * validate and sanitize
   *
   * @return {Promise}
   */
  _validateAndSanitize: async function () {

    const oThis = this
    ;

    // validate / sanitize page number
    let pageNoVas = commonValidator.validateAndSanitizePageNo(oThis.pageNo);
    if(!pageNoVas[0]) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_l_fci_3',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_page_no'],
        debug_options: {}
      }));
    }
    oThis.pageNo = pageNoVas[1];

    // validate / sanitize limit
    let limitVas = commonValidator.validateAndSanitizeLimit(oThis.limit);
    if(!limitVas[0]) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_l_fci_4',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_pagination_limit'],
        debug_options: {}
      }));
    }
    oThis.limit = limitVas[1];

    // compute offset
    oThis.offset = (oThis.pageNo - 1) * oThis.limit;

    // validate / sanitize order_by : only possible value for order by is created
    if (oThis.orderBy && (oThis.orderBy.toLowerCase() != 'created')) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_l_fci_5',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_order_by'],
        debug_options: {clientId: oThis.clientId}
      }));
    }
    oThis.orderBy = oThis.orderBy || 'created';
    oThis.orderBy = oThis.orderBy.toLowerCase();

    // validate / sanitize order :
    if (oThis.order && !commonValidator.isValidOrderingString(oThis.order)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_l_fci_6',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_order'],
        debug_options: {clientId: oThis.clientId}
      }));
    }
    oThis.order = oThis.order || 'desc';
    oThis.order = oThis.order.toLowerCase();

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Get transaction log data
   *
   * @return {Promise}
   */
  _getFilteredUuids: async function (queryParams) {
    const oThis = this
    ;

    let searchRsp = await ddbSearchServiceObject.search(queryParams);
    if(searchRsp.isFailure()) {return Promise.reject(searchRsp)}

    let searchData = searchRsp.data
        , meta = searchData.meta
        , transaction_logs = searchData.transaction_logs
        , transaction_uuids = []
    ;

    for(let i=0; i<transaction_logs.length; i++) {
      transaction_uuids.push(transaction_logs[i].id);
    }

    oThis.transactionUuids = transaction_uuids;

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * get pagination params for search query
   *
   * @return {object}
   */
  _getPaginationParams: function () {

    let paginationParams = {
      "from" : oThis.offset,
      "size" : oThis.limit,
      "sort": [
        { oThis.orderBy : oThis.order }
      ]
    };

    return paginationParams;

  },

  /**
   * Get transaction log data
   *
   * @return {Promise}
   */
  _getDataForUuids: async function () {
    const oThis = this
    ;

    let transactionFetchRespone = await new OSTStorage.TransactionLogModel({
      client_id: oThis.clientId,
      ddb_service: ddbServiceObj
    }).batchGetItem(oThis.transactionUuids);

    // if no records found, return error.
    if (!transactionFetchRespone.data) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_l_b_2',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }

    let transactionLogData = transactionFetchRespone.data;

    return responseHelper.successWithData(transactionLogData);

  }

};

module.exports = Base;