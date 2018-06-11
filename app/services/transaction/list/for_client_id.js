"use strict";

const rootPrefix = '../../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , BaseKlass = require(rootPrefix + '/app/services/transaction/list/base')
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
const GetTransactionListByClientId = function(params) {
  var oThis = this
  ;

  BaseKlass.apply(oThis, arguments);

  oThis.idsFilterStr = params.id;

  oThis.offset = null;
  oThis.idsFilterArr = [];

};


GetTransactionListByClientId.prototype = Object.create(BaseKlass.prototype);

const GetTransactionListForClient = {

  /**
   * validateAndSanitize
   *
   * @return {Promise}
   */
  _validateAndSanitize: async function () {

    var oThis = this
    ;

    await oThis._baseValidateAndSanitize.apply( oThis );

    if (oThis.idsFilterStr && oThis.idsFilterStr.length > 0) {
      oThis.idsFilterArr = basicHelper.commaSeperatedStrToArray(oThis.idsFilterStr);
      if (oThis.idsFilterArr.length > 100) {
        return Promise.reject(responseHelper.paramValidationError({
          internal_error_identifier: 's_t_l_fci_2',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_id_filter'],
          debug_options: {clientId: oThis.clientId}
        }));
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

    // filter by client id
    let boolFilters = [
        {"term":  { "client_id": oThis.clientId } },
        {"term":  { "transaction_type": 1 } }
      ];

    // if transaction_uuids are passes in params, add filter on it
    if (oThis.idsFilterArr.length > 0) {
      filteringParams['query']['terms'] = { "id" : oThis.idsFilterArr };
    }

    filteringParams['query']['bool']['filter'] = boolFilters;

    Object.assign(filteringParams, oThis._getPaginationParams());

    oThis.filteringParams = filteringParams;

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

Object.assign(GetTransactionListByClientId.prototype, GetTransactionListForClient);

module.exports = GetTransactionListByClientId;