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
  oThis.user_uuid = params.id;
  oThis.status = params.status;
};

GetTransactionList.prototype = Object.create(BaseKlass.prototype);

const GetTransactionListForUser = {
  /**
   *
   * Perform
   *
   * @return {Promise}
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
            internal_error_identifier: 's_t_l_fui_1',
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
        internal_error_identifier: 's_t_l_fui_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['missing_client_id'],
        debug_options: {}
      }));
    }

    if ( !basicHelper.isUuidValid(oThis.user_uuid)) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_l_fui_3',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id'],
        debug_options: {}
      }));
    }

    let transactionLog = new TransactionLogModel();
    if ( !Object.keys(transactionLog.statuses).includes(oThis.status) ) { // TODO: Might need to invert the status based on input
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_l_fui_4',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_transaction_status'],
        debug_options: {}
      }));
    }

  },

  getFilteredUuids: async function () {
    const oThis = this
    ;

    oThis.uuids = ['7bbde231-8315-4c74-b570-98da28e61cb9'];

  }

};

Object.assign(GetTransactionList.prototype, GetTransactionListForUser);

module.exports = GetTransactionList;