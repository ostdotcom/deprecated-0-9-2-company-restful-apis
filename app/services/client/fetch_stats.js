"use strict";

const rootPrefix = '../../..'
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
    , ClientTxKindCntCacheKlass = require(rootPrefix + '/lib/cache_management/client_transaction_type_count')
;

/**
 * constructor
 *
 * @constructor
 */
const clientStatsKlass = function (params) {

  const oThis = this;

  oThis.clientId = params['client_id'];

};

clientStatsKlass.prototype = {

  perform: function(params){
    const oThis = this;

    return oThis.asyncPerform(params)
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 's_c_fs_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  /**
   * fetch data
   *
   * @return {Promise<result>}
   */
  asyncPerform: async function (params) {

    const oThis = this;

    const cacheObj = new ClientTxKindCntCacheKlass({clientId: oThis.clientId});

    const txKindCountData = await cacheObj.fetch();

    if (txKindCountData.isFailure()) {
      return Promise.resolve(txKindCountData);
    }

    return Promise.resolve(responseHelper.successWithData({
      transaction_kind_count: txKindCountData.data
    }));

  }

};

module.exports = clientStatsKlass;