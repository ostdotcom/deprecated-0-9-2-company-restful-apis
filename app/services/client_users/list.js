"use strict";

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , managedAddress = new ManagedAddressKlass()
  , EconomyUserBalanceKlass = require(rootPrefix + '/lib/economy_user_balance')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

/**
 * constructor
 *
 * @constructor
 */
const listKlass = function () {

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

    params.limit = pageSize;

    if (!params.client_id) {
      return Promise.resolve(responseHelper.error('cu_l_1', 'invalid client id'));
    }

    if (!params.page_no || parseInt(params.page_no) < 1) {
      params.page_no = 1;
      params.offset = 0
    } else {
      params.page_no = parseInt(params.page_no);
      params.offset = ((params.limit - 1) * (params.page_no - 1))
    }

    if (!params.order_by || params.order_by.toString().toLowerCase() != 'name') {
      params.order_by = 'creation_time';
    }

    if (!params.order || params.order.toString().toLowerCase() != 'asc') {
      params.order = 'desc';
    }

    const queryResponse = await managedAddress.getByFilterAndPaginationParams(params);

    var usersList = []
      , ethereumAddresses = []
      , length = queryResponse.length
      , hasMore = false;

    for (var i = 0; i < length; i++) {
      const object = queryResponse[i];

      if (!object['name']) {
        continue;
      }

      if (i === pageSize - 1) {
        continue;
      }
      ethereumAddresses.push(object['ethereum_address']);
    }

    const economyUserBalance = new EconomyUserBalanceKlass({
        client_id: params.client_id,
        ethereum_addresses: ethereumAddresses
      })
      , userBalancesResponse = await economyUserBalance.perform()
    ;

    var balanceHashData = {};

    if (!userBalancesResponse.isFailure()) {
      balanceHashData = userBalancesResponse.data;
    }

    for (var i = 0; i < length; i++) {

      const object = queryResponse[i];

      if (!object['name']) {
        continue;
      }

      if (i === pageSize - 1) {
        hasMore = true;
        continue;
      }

      const balanceData = balanceHashData[object['ethereum_address']];

      usersList.push({
        name: object['name'],
        uuid: object['uuid'],
        total_airdropped_tokens: basicHelper.convertToNormal(balanceData.totalAirdroppedTokens).toString(10),
        token_balance: basicHelper.convertToNormal(balanceData.tokenBalance).toString(10)
      })

    }

    var next_page_payload = {};
    if (hasMore) {
      next_page_payload = {
        order_by: params.order_by,
        order: params.order,
        filter: params.filter,
        page_no: params.page_no + 1
      };
    }

    return Promise.resolve(responseHelper.successWithData({
      result_type: 'economy_users',
      'economy_users': usersList,
      meta: {
        next_page_payload: next_page_payload
      }
    }));

  }

};

module.exports = listKlass;