'use strict';

const rootPrefix = '../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  EconomyUserBalanceKlass = require(rootPrefix + '/lib/economy_user_balance'),
  basicHelper = require(rootPrefix + '/helpers/basic');

/**
 * constructor
 *
 * @constructor
 */
const GetUsersDataKlass = function(params) {
  const oThis = this;

  oThis.ethAddresses = params.ethereum_addresses;
  oThis.clientId = params.client_id;
};

GetUsersDataKlass.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 's_cu_gud_3',
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
  asyncPerform: async function() {
    const oThis = this;
    var users = await new ManagedAddressModel().getByEthAddresses(oThis.ethAddresses);

    if (users.length <= 0) {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 's_cu_gabu_1',
          api_error_identifier: 'data_not_found',
          debug_options: {}
        })
      );
    }

    const economyUserBalance = new EconomyUserBalanceKlass({
        client_id: oThis.clientId,
        ethereum_addresses: oThis.ethAddresses
      }),
      userBalancesResponse = await economyUserBalance.perform();

    var balanceHashData = null;
    if (!userBalancesResponse.isFailure()) {
      balanceHashData = userBalancesResponse.data;
    }

    var response = {};
    for (var i = 0; i < users.length; i++) {
      var user = users[i];

      if (user['client_id'] != oThis.clientId) {
        return Promise.resolve(
          responseHelper.error({
            internal_error_identifier: 's_cu_gud_2',
            api_error_identifier: 'unauthorized_for_other_client',
            debug_options: {}
          })
        );
      }

      var balanceData = balanceHashData[user['ethereum_address']];

      if (!balanceData) {
        var lowerCasedAddr = user['ethereum_address'].toLowerCase();
        balanceData = balanceHashData[lowerCasedAddr];
      }

      Object.assign(user, {
        total_airdropped_tokens: basicHelper.convertToNormal(balanceData.totalAirdroppedTokens).toString(10),
        balance_airdrop_amount: basicHelper.convertToNormal(balanceData.balanceAirdropAmount).toString(10),
        token_balance: basicHelper.convertToNormal(balanceData.tokenBalance).toString(10)
      });

      response[user['ethereum_address']] = user;
    }

    return responseHelper.successWithData(response);
  }
};

module.exports = GetUsersDataKlass;
