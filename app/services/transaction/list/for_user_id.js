"use strict";

const rootPrefix = '../../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , BaseKlass = require(rootPrefix + '/app/services/transaction/list/base')
  , commonValidator = require(rootPrefix +  '/lib/validators/common')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

const GetTransactionList = function(params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
  oThis.userUuid = params.id;
  oThis.pageNo = params.page_no;
  oThis.orderBy = params.order_by;
  oThis.order = params.order;
  oThis.limit = params.limit;
  oThis.statusStr = params.status;

  oThis.statusesIntArray = [];
  
};

GetTransactionList.prototype = Object.create(BaseKlass.prototype);

const GetTransactionListForUser = {

  /**
   * validateAndSanitize
   * 
   */
  _validateAndSanitize: async function () {
    
    const oThis = this
    ;

    await BaseKlass.call(this);

    if (!basicHelper.isUuidValid(oThis.userUuid)) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_l_fui_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id_user'],
        debug_options: {}
      }));
    }

    if (oThis.statusStr) {

      let statusesStrArray = basicHelper.commaSeperatedStrToArray(oThis.statusStr);

      let statusesStrToIntMap = new TransactionLogModel().invertedStatuses;

      for(var i=0; i < statusesStrArray.length; i++){
        let statusInt = statusesStrToIntMap[statusesStrArray[i].toLowerCase()];
        if (!statusInt) {
          return Promise.reject(responseHelper.error({
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
   * @return {object}
   */
  _getFilteringParams: function () {

    const oThis = this;

    let filteringParams = {
      "query": {}
    }

    // filter by client id
    let boolFilters = {
      "term":  { "client_id": oThis.clientId },
      "bool": {
        "should": {
          "term":  { "from_uuid": oThis.userUuid },
          "term":  { "to_uuid": oThis.userUuid }
        }
      }
    };

    // if statuses are passes in params, add filter on it
    if (oThis.statusesIntArray.length > 0) {
      boolFilters['terms'] = { "status" : oThis.statusesIntArray };
    }

    filteringParams['query']['bool']['filter']['must'] = [boolFilters];

    Object.assign(filteringParams, oThis._getPaginationParams());

    return filteringParams;

  }

};

Object.assign(GetTransactionList.prototype, GetTransactionListForUser);

module.exports = GetTransactionList;