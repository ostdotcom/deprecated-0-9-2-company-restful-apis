"use strict";

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
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
            internal_error_identifier: 's_cu_l_2',
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

    const oThis = this
      , pageSize = 26;

    params.limit = pageSize;

    if (!params.client_id) {
      return Promise.resolve(responseHelper.paramValidationError({
        internal_error_identifier: 's_cu_l_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_client_id'],
        debug_options: {}
      }));
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

    const queryResponse = await new ManagedAddressModel().getByFilterAndPaginationParams(params);

    var usersList = []
      , ethereumAddresses = []
      , hasMore = false;

    for (var i = 0; i < queryResponse.length; i++) {
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

    for (var i = 0; i < queryResponse.length; i++) {

      const object = queryResponse[i];

      if (!object['name']) {
        continue;
      }

      if (i === pageSize - 1) {
        hasMore = true;
        continue;
      }

      logger.info("object['ethereum_address'] ", object['ethereum_address']);

      var balanceData = balanceHashData[object['ethereum_address']];
      if (!balanceData) {
        var lowerCasedAddr = object['ethereum_address'].toLowerCase();
        balanceData = balanceHashData[lowerCasedAddr];
      }

      usersList.push({
        id: object['uuid'],
        name: object['name'],
        uuid: object['uuid'],
        total_airdropped_tokens: basicHelper.convertToNormal((balanceData || {}).totalAirdroppedTokens).toString(10),
        token_balance: basicHelper.convertToNormal((balanceData || {}).tokenBalance).toString(10)
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