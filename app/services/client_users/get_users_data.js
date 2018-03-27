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
const GetUsersDataKlass = function (params) {

  const oThis = this;

  oThis.ethAddresses = params.ethereum_addresses;
  oThis.clientId = params.client_id;
};

GetUsersDataKlass.prototype = {

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch((error) => {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_cu_gud_3", "Unhandled result", null, {}, {});
        }
      })
  },
  /**
   * fetch data
   *
   * @return {Promise<result>}
   */
  asyncPerform: async function () {
    const oThis = this;
    var users = await managedAddress.getByEthAddresses(oThis.ethAddresses);

    if (users.length <= 0) {
      return Promise.resolve(responseHelper.error("s_cu_gud_1", "No Data found"));
    }

    const economyUserBalance = new EconomyUserBalanceKlass({client_id: oThis.clientId, ethereum_addresses: oThis.ethAddresses})
      , userBalancesResponse = await economyUserBalance.perform()
      ;

    var balanceHashData = null;
    if (!userBalancesResponse.isFailure()) {
      balanceHashData = userBalancesResponse.data;
    }

    var response = {};
    for (var i = 0; i < users.length; i++) {
      var user = users[i];

      if (user['client_id'] != oThis.clientId) {
        return Promise.resolve(responseHelper.error("s_cu_gud_2", "Invalid client details."));
      }

      var balanceData = balanceHashData[user['ethereum_address']];

      if (!balanceData) {
        var lowerCasedAddr = user['ethereum_address'].toLowerCase();
        balanceData = balanceHashData[lowerCasedAddr];
      }

      Object.assign(
        user,
        {
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