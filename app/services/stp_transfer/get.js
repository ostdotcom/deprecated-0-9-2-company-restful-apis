"use strict";

const rootPrefix = '../../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , StPrimeTransferFormatter = require(rootPrefix + '/lib/formatter/entities/latest/stp_transfer')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
;

/**
 * @constructor
 *
 * @param {object} params - service params
 * @param {number} params.client_id (mandatory) - client id
 * @param {string} params.id (mandatory) - uuid of the transfer to fetch info for
 */
const GetStPTransferService = function (params) {
  const oThis = this
  ;

  oThis.transactionUuid = params.id;
  oThis.client_id = params.client_id;
};

GetStPTransferService.prototype = {
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
            internal_error_identifier: 's_stpt_g_1',
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

    await oThis._fetchRecord();

    return oThis._formatApiResponse();
  },

  /**
   * Async perform
   *
   * Sets oThis.record
   *
   * @return {promise<result>}
   */
  _fetchRecord: async function () {
    const oThis = this
    ;

    let transactionLogs = await new TransactionLogModel().getByTransactionUuid([oThis.transactionUuid]);
    let transactionLog = transactionLogs[0];
    if (!transactionLog) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stpt_g_2',
        api_error_identifier: 'invalid_id_transfer_get',
        debug_options: {}
      }));
    }

    if (oThis.client_id != transactionLog.client_id) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_stpt_g_3',
        api_error_identifier: 'invalid_id_transfer_get',
        debug_options: {}
      }));
    }

    let transactionLogType = new TransactionLogModel().transactionTypes[transactionLog.transaction_type];

    if (transactionLogType != transactionLogConst.stpTransferTransactionType) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_stpt_g_4',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_transaction_get'],
        debug_options: {}
      }));
    }

    oThis.record = transactionLog;

    return Promise.resolve({});
  },

  /**
   * Format api response
   *
   * @return {promise<result>}
   */
  _formatApiResponse: async function () {
    const oThis = this
    ;

    let apiResponseData = {
      result_type: 'transaction'
    };

    let stPrimeTransferFormatter = new StPrimeTransferFormatter(oThis.record)
      , stPrimeTransferFormatterResponse = await stPrimeTransferFormatter.perform()
    ;

    if (stPrimeTransferFormatterResponse.isFailure()) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_stpt_g_5',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id_transfer_get'],
        debug_options: {}
      }));
    }

    apiResponseData.transaction = stPrimeTransferFormatterResponse.data;

    return responseHelper.successWithData(apiResponseData);
  }

};

module.exports = GetStPTransferService;