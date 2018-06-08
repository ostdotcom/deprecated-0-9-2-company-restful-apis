"use strict";

const rootPrefix = '../../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , BaseKlass = require(rootPrefix + '/app/services/transaction/list/base')
  , commonValidator = require(rootPrefix +  '/lib/validators/common')
;

const GetTransactionList = function(params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
  oThis.pageNo = params.page_no;
  oThis.orderBy = params.order_by;
  oThis.order = params.order;
  oThis.limit = params.limit;
  oThis.status = params.status;

  oThis.offset = null;

};


GetTransactionList.prototype = Object.create(BaseKlass.prototype);

const GetTransactionListForClient = {
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

    return oThis.asyncPerform()
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 's_t_l_fci_1',
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
  asyncPerform: async function() {
    const oThis = this
    ;

    await oThis.validateAndSanitize();

    await oThis.getFilteredUuids();

    return oThis.getDataForUuids();
  },

  /**
   * validateAndSanitize
   *
   */
  validateAndSanitize: async function () {
    const oThis = this
    ;

    if (commonValidator.isVarNull(oThis.clientId)) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_l_fci_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['missing_client_id'],
        debug_options: {}
      }));
    }

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

    oThis.offset = (oThis.pageNo - 1) * oThis.limit;

    // only possible value for order by is created
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
    if (oThis.orderBy == 'created') oThis.orderByForQuery = 'id';

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


  },

  getFilteredUuids: async function () {
    const oThis = this
    ;

    // uuids for client_id - 1146
    oThis.uuids =  ['7bbde231-8315-4c74-b570-98da28e61cb9'];
  }

};

Object.assign(GetTransactionList.prototype, GetTransactionListForClient);

module.exports = GetTransactionList;