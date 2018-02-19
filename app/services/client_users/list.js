"use strict";

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix+'/lib/logger/custom_console_logger')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , managedAddress = new ManagedAddressKlass()
;

/**
 * constructor
 *
 * @constructor
 */
const listKlass = function() {

};

listKlass.prototype = {

  /**
   * fetch data
   *
   * @return {Promise<result>}
   */
  perform: async function (params) {

    const oThis = this
        , pageSize = 26;

    params.pageSize = pageSize;

    if (!params.client_id) {
      return Promise.resolve(responseHelper.error('cu_l_1', 'invalid client id'));
    }

    if(!params.page_no || parseInt(params.page_no) < 1) {
      params.page_no = 1;
    } else {
      params.page_no = parseInt(params.page_no);
    }

    const queryResponse = await managedAddress.getByFilterAndPaginationParams(params);

    var usersList = []
        , length = queryResponse.length
        , hasMore = false;

    for (var i=0; i<length; i++) {

      var object = queryResponse[i];

      if (!object['name']) {
        continue;
      }

      if (i==pageSize-1) {
        hasMore = true;
        continue;
      }

      usersList.push({
            id: object['id'],
            name: object['name'],
            uuid: object['uuid'],
            total_airdropped_tokens: 0,
            token_balance: 0
          })

    };

    var next_page_payload = {};
    if (hasMore) {
      next_page_payload = {
        sort_by: params.sort_by,
        filter: params.filter,
        page_no: params.page_no + 1
      }
    };

    return Promise.resolve(responseHelper.successWithData({
      result_type: 'economy_users',
      'economy_users': usersList,
      meta: {
        next_page_payload: next_page_payload,
      }
    }));

  }

}

module.exports = listKlass;