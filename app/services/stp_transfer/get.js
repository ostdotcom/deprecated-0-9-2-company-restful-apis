"use strict";

const rootPrefix = '../../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , StPrimeTransferFormatter = require(rootPrefix + '/lib/formatter/entities/latest/stp_transfer')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
;


/**
 *
 * @constructor
 */
const GetStPrime = function(params) {
  const oThis = this;
  oThis.id = params.id;
  oThis.client_id = params.client_id;
};

GetStPrime.prototype = {
  /**
   * perform
   *
   * @returns {Promise}
   */
  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
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

  asyncPerform: async function(){
    const oThis = this;

    await oThis.getStPrimeData();

    let formattedResponse = await oThis.formatResponse();

    return Promise.resolve(formattedResponse);
  },

  getStPrimeData: async function() {
    const oThis = this
    ;

    let transactionLogs = await new TransactionLogModel().getById([oThis.id]);
    let transactionLog = transactionLogs[0];
    if(!transactionLog) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stpt_g_2',
        api_error_identifier: 'transaction_log_invalid',
        debug_options: {}
      }));
    }

    oThis.transactionLog = transactionLog;

    if (oThis.client_id != transactionLog.client_id) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_stpt_g_3',
        api_error_identifier: 'unauthorized_api_request',
        debug_options: {clientId: oThis.clientId, id: transactionLog.transaction_uuid }
      }));
    }

    let transactionLogType = new TransactionLogModel().transactionTypes[transactionLog.transaction_type];

    if( transactionLogType != transactionLogConst.stpTransferTransactionType) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_stpt_g_4',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_transaction_get'],
        debug_options: {clientId: oThis.client_id, id: transactionLog.transaction_uuid }
      }));
    }

    return Promise.resolve({});
  },

  formatResponse: async function () {
    const oThis = this;

    let stPrimeTransferFormatter = new StPrimeTransferFormatter(oThis.transactionLog);

    let stPrimeTransferFormatterResponse = await stPrimeTransferFormatter.perform();

    return Promise.resolve(responseHelper.successWithData({
      result_type: "transfer",
      "transfer": stPrimeTransferFormatterResponse.data
    }));
  }

};

module.exports = GetStPrime;