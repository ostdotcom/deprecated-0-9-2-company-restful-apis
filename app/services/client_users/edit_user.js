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
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

const editUser = {

  perform: function(clientId, userUuid, name){
    const oThis = this;

    return oThis.asycnPerform(clientId, userUuid, name)
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 's_cu_eu_4',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
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
      , errors_object = [];

    if (!clientId || !userUuid) {
      return responseHelper.error({
        internal_error_identifier: 's_cu_eu_1',
        api_error_identifier: 'invalid_api_params',
        debug_options: {}
      });
    }

    if (name) {
      name = name.trim();
    }

    if(!basicHelper.isUserNameValid(name)){
      errors_object.push('invalid_username');
    } else if(basicHelper.hasStopWords(name)){
      errors_object.push('inappropriate_username');
    }

    if(Object.keys(errors_object).length > 0){
      return responseHelper.paramValidationError({
        internal_error_identifier: 's_cu_eu_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: errors_object
        debug_options: {}
      });
    }

    var managedAddressCache = new ManagedAddressCacheKlass({'uuids': [userUuid]});

    const cacheFetchResponse = await managedAddressCache.fetch();

    if (cacheFetchResponse.isFailure()) {
      return responseHelper.error({
        internal_error_identifier: 's_cu_eu_2',
        api_error_identifier: 'resource_not_found',
        debug_options: {}
      });
    }

    const response = cacheFetchResponse.data[userUuid];

    if (!response) {
      return responseHelper.error({
        internal_error_identifier: 's_cu_eu_2.1',
        api_error_identifier: 'resource_not_found',
        debug_options: {}
      });
    }

    if (response['client_id'] != clientId) {
      return responseHelper.error({
        internal_error_identifier: 's_cu_eu_3',
        api_error_identifier: 'unauthorized_for_other_client',
        debug_options: {}
      });
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

    new ManagedAddressModel().update({name: name}).where({uuid: userUuid}).fire();

    managedAddressCache.clear();

    return responseHelper.successWithData(apiResponseData);
  }
};

module.exports = editUser;