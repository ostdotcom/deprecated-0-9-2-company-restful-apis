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

  /**
   * fetch data
   *
   * @return {Promise<result>}
   */
  perform: async function (params) {

    const oThis = this
        , cacheObj = new ClientTxKindCntCacheKlass({clientId: oThis.clientId});

    const txKindCountData = await cacheObj.fetch();

    if (txKindCountData.isFailure()) {
      return Promise.resolve(txKindCountData);
    }

    return Promise.resolve(responseHelper.successWithData({
      transaction_kind_count: txKindCountData.data
    }));

  }

}

module.exports = clientStatsKlass;