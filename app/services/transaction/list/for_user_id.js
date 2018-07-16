"use strict";

const rootPrefix = '../../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , BaseKlass = require(rootPrefix + '/app/services/transaction/list/base')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
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

    const managedAddressCacheFetchResponse = await new ManagedAddressCacheKlass({'uuids': [oThis.userUuid]}).fetch();
    if (managedAddressCacheFetchResponse.isFailure()) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_l_fui_3',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    const managedAddressCacheData = managedAddressCacheFetchResponse.data[oThis.userUuid]
      , userAddressType = new ManagedAddressModel().invertedAddressTypes[managedAddressesConst.userAddressType]
    ;

    if (!managedAddressCacheData || managedAddressCacheData['client_id'] != oThis.clientId || managedAddressCacheData['address_type'] != userAddressType) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_l_fui_4',
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
            internal_error_identifier: 's_t_l_fui_5',
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

    // if statuses are passes in params, add filter on it
    if (oThis.statusesIntArray.length > 0) {
      let statusSubQuery = `(${oThis.statusesIntArray.join(' OR ')})`;
      boolFilters.push({
        "query_string" : {
          "query": `( ${oThis.userUuid}) AND ${statusSubQuery} )`,
          "fields": ["query_uuid"]
        }
      })
    } else {
      boolFilters.push({
        "query_string" : {
          "query": `(${oThis.userUuid}))`,
          "fields": ["query_uuid"]
        }
      })
    }

    // https://www.elastic.co/guide/en/elasticsearch/guide/current/bool-query.html
    filteringParams['query']['bool']['filter'] = boolFilters;

    filteringParams['query']['bool']['must'] =  {
      "bool": {
        "should": [
          {"match": {"from_uuid": oThis.userUuid}},
          {"match": {"to_uuid": oThis.userUuid}}
        ]
      }
    };

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

    let payload = {
      order_by: oThis.orderBy,
      order: oThis.order,
      page_no: oThis.pageNo + 1,
      limit: oThis.limit
    };

    if(oThis.statusStr) {payload['status'] = oThis.statusStr}

    return payload;

  }

};

Object.assign( GetTransactionList.prototype, GetTransactionListForUser);

module.exports = GetTransactionList;