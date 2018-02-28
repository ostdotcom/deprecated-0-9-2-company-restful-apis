"use strict";

/**
 * Edit Name of a user
 *
 * @module services/client_users/edit_user
 */
const rootPrefix = '../../..'
  , EconomyUserBalanceKlass = require(rootPrefix + '/lib/economy_user_balance')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

const editUser = {

  /**
   * Perform Edit user operation
   *
   * @param clientId
   * @param userUuid
   * @param name
   * @return {Promise<result>}
   */
  perform: async function (clientId, userUuid, name) {

    const oThis = this;

    if (!clientId || !userUuid || !name) {
      return responseHelper.error("s_cu_eu_1", "Mandatory parameters missing");
    }

    const managedAddressCache = new ManagedAddressCacheKlass({'uuids': [userUuid]});

    const cacheFetchResponse = await managedAddressCache.fetch();

    if (cacheFetchResponse.isFailure()) {
      return responseHelper.error("s_cu_eu_2", "User not found");
    }

    const response = cacheFetchResponse.data[userUuid];

    if (!response) {
      return responseHelper.error("s_cu_eu_2.1", "User not found");
    }

    if (response['client_id'] != clientId) {
      return responseHelper.error("s_cu_eu_3", "User does not belong to client");
    }

    const ethereumAddress = response['ethereum_address']
      , economyUserBalance = new EconomyUserBalanceKlass({client_id: clientId, ethereum_addresses: [ethereumAddress]})
      , userBalance = await economyUserBalance.perform()
    ;

    var totalAirdroppedTokens = 0
      , tokenBalance = 0
    ;

    if (!userBalance.isFailure()) {
      const userBalanceData = userBalance.data[ethereumAddress];

      totalAirdroppedTokens = userBalanceData['totalAirdroppedTokens'];
      tokenBalance = userBalanceData['tokenBalance'];
    }

    const apiResponseData = {
      result_type: "economy_users",
      'economy_users': [
        {
          uuid: userUuid,
          name: name,
          total_airdropped_tokens: basicHelper.convertToNormal(totalAirdroppedTokens),
          token_balance: basicHelper.convertToNormal(tokenBalance)
        }
      ],
      meta: {
        next_page_payload: {}
      }
    };

    if (response['name'] === name) {
      return responseHelper.successWithData(apiResponseData);
    }

    const managedAddressObj = new ManagedAddressKlass();

    const updateQueryResponse = managedAddressObj.edit({
      qParams: {
        name: name
      },
      whereCondition: {
        uuid: userUuid
      }
    });

    managedAddressCache.clear();

    return responseHelper.successWithData(apiResponseData);

  }

};

module.exports = editUser;