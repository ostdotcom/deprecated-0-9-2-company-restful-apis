"use strict";

const OSTStorage = require('@openstfoundation/openst-storage');

const rootPrefix = '../../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , autoScalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
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

    await oThis._validateId();

    return oThis._fetchRecord();

  },

  /**
   * validate id
   *
   * @return {promise<result>}
   */
  _validateId: async function() {
    const oThis = this
    ;

    if (!basicHelper.isUuidValid(oThis.transactionUuid)) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stpt_g_2',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }

    return responseHelper.successWithData({});
  },

  /**
   * Async perform
   *
   *
   * @return {promise<result>}
   */
  _fetchRecord: async function () {
    const oThis = this
    ;

    let transactionLogResponse = await new OSTStorage.TransactionLogModel({
      client_id: oThis.client_id,
      ddb_service: ddbServiceObj,
      auto_scaling: autoScalingServiceObj
    }).batchGetItem([oThis.transactionUuid]);

    if (!transactionLogResponse.data[oThis.transactionUuid]) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stpt_g_3',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }

    let transactionLog = transactionLogResponse.data[oThis.transactionUuid];

    if (oThis.client_id != transactionLog.client_id) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stpt_g_4',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }

    let transactionLogType = new TransactionLogModel().transactionTypes[transactionLog.transaction_type];

    if (transactionLogType != transactionLogConst.stpTransferTransactionType) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stpt_g_5',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }

    return responseHelper.successWithData(transactionLog);
  }

};

module.exports = GetStPTransferService;