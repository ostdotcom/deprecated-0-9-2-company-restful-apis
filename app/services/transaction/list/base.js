"use strict";

const OSTStorage = require('@openstfoundation/openst-storage');

const rootPrefix = '../../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
;

const Base = function(params) {
  const oThis = this
  ;

};

Base.prototype = {

  /**
   * Get transaction log data
   *
   * @return {Promise}
   */
  getDataForUuids: async function () {
    const oThis = this
    ;

    let transactionFetchRespone = await new OSTStorage.TransactionLogModel({
      client_id: oThis.clientId,
      ddb_service: ddbServiceObj
    }).batchGetItem(oThis.uuids);

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