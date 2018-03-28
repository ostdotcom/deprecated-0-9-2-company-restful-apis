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
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

const editUser = {

  perform: function(clientId, userUuid, name){
    const oThis = this;

    return oThis.asycnPerform(clientId, userUuid, name)
      .catch((error) => {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_cu_eu_4", "Unhandled result", null, {}, {});
        }
      });
  },

  /**
   * Perform Edit user operation
   *
   * @param clientId
   * @param userUuid
   * @param name
   * @return {Promise<result>}
   */
  asycnPerform: async function (clientId, userUuid, name) {

    const oThis = this
      , errors_object = {};

    if (!clientId || !userUuid) {
      return responseHelper.error("s_cu_eu_1", "Mandatory parameters missing");
    }

    if (name) {
      name = name.trim();
    }

    if(!basicHelper.isUserNameValid(name)){
      errors_object['name'] = 'Only letters, numbers and spaces allowed. (3 to 20 characters)';
    }

    if(basicHelper.hasStopWords(name)){
      errors_object['name'] = 'Come on, the ' + name + ' you entered is inappropriate. Please choose a nicer word.';
    }

    if(Object.keys(errors_object).length > 0){
      return responseHelper.error('s_cu_eu_2', 'invalid params', '', [errors_object]);
    }

    var managedAddressCache = new ManagedAddressCacheKlass({'uuids': [userUuid]});

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
          id: userUuid,
          uuid: userUuid,
          name: name,
          total_airdropped_tokens: basicHelper.convertToNormal(totalAirdroppedTokens).toString(10),
          token_balance: basicHelper.convertToNormal(tokenBalance).toString(10)
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