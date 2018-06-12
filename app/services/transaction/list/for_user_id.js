"use strict";

const rootPrefix = '../../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , BaseKlass = require(rootPrefix + '/app/services/transaction/list/base')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

const BaseKlassProto = BaseKlass.prototype;

/**
 * @constructor
 *
 * @param {object} params - service params
 * @param {number} params.client_id (mandatory) - client id
 * @param {number} params.page_no (optional) - page number (starts from 1)
 * @param {string} params.order_by (optional) - order the list by 'created' (default)
 * @param {string} params.order (optional) - order list in 'desc' (default) or 'asc' order.
 * @param {number} params.limit (optional) - Min 1, Max 100, Default 10.
 * @param {string} params.status (optional) - comma separated status(s) to filter
 */
const GetTransactionList = function (params) {
  var oThis = this
  ;

  BaseKlass.apply(oThis, arguments);

  oThis.userUuid = params.id;
  oThis.statusStr = params.status;

  oThis.statusesIntArray = [];

};

GetTransactionList.prototype = Object.create( BaseKlass.prototype ) ;

const GetTransactionListForUser = {

  /**
   * validateAndSanitize
   *
   */
  _validateAndSanitize: async function () {

    var oThis = this
    ;

    await oThis._baseValidateAndSanitize.apply( oThis );

    if (!basicHelper.isUuidValid(oThis.userUuid)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_l_fui_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id_user'],
        debug_options: {}
      }));
    }

    if (oThis.statusStr) {

      let statusesStrArray = basicHelper.commaSeperatedStrToArray(oThis.statusStr);

      let statusesStrToIntMap = new TransactionLogModel().invertedStatuses;

      for (var i = 0; i < statusesStrArray.length; i++) {
        let statusInt = statusesStrToIntMap[statusesStrArray[i].toLowerCase()];
        if (!statusInt) {
          return Promise.reject(responseHelper.paramValidationError({
            internal_error_identifier: 's_t_l_fui_3',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['invalid_status_transactions_ledger'],
            debug_options: {}
          }));
        } else {
          oThis.statusesIntArray.push(parseInt(statusInt));
        }
      }

    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * get filtering params
   *
   * @return {Promise}
   */
  _getFilteringParams: function () {

    var oThis = this;

    let filteringParams = {
      "query": {
        "bool": {}
      }
    };

    // filter by client id , transaction type and user id
    let boolFilters = oThis._getCommonFilteringParams();
    boolFilters.push({
      "bool": {
        "should": [
          {"term": {"from_uuid": oThis.userUuid}},
          {"term": {"to_uuid": oThis.userUuid}}
        ]
      }
    });

    // if statuses are passes in params, add filter on it
    if (oThis.statusesIntArray.length > 0) {
      boolFilters.push({'terms': {"status": oThis.statusesIntArray}});
    }

    filteringParams['query']['bool']['filter'] = boolFilters;

    Object.assign(filteringParams, oThis._getPaginationParams());

    oThis.filteringParams = filteringParams;

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * get next page payload
   *
   * @return {object}
   */
  _getNextPagePayload: function () {

    var oThis = this;

    return {};

  }


};

Object.assign( GetTransactionList.prototype, GetTransactionListForUser);

module.exports = GetTransactionList;