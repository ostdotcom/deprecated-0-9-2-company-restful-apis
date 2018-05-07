"use strict";

const rootPrefix = '../../..'
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
    , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
    , EconomyUserBalanceKlass = require(rootPrefix + '/lib/economy_user_balance')
    , UserEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/user')
    , basicHelper = require(rootPrefix + '/helpers/basic')
    , commonValidator = require(rootPrefix +  '/lib/validators/common')
;

/**
 *
 * @constructor
 *
 * @param {object} params - this is object with keys.
 * @param {integer} params.client_id - client_id for which users are to be fetched
 * @param {string} params.id - identifier of user which is to be fetched
 *
 */
const fetchUserKlass = function (params) {

  const oThis = this;

  oThis.userUuid = params.id;

};

fetchUserKlass.prototype = {

  /**
   *
   * Perform
   *
   * @return {Promise<result>}
   *
   */
  perform: function(){

    const oThis = this;

    return oThis.asyncPerform()
        .catch(function(error) {
          if (responseHelper.isCustomResult(error)){
            return error;
          } else {
            logger.error(`${__filename}::perform::catch`);
            logger.error(error);
            return responseHelper.error({
              internal_error_identifier: 's_cu_fu_1',
              api_error_identifier: 'unhandled_catch_response',
              debug_options: {}
            });
          }
        });
  },

  /**
   *
   * Perform
   *
   * @private
   *
   * @return {Promise<result>}
   *
   */
  asyncPerform: async function () {

    const oThis = this;

    var managedAddressCache = new ManagedAddressCacheKlass({'uuids': [userUuid]});

    const cacheFetchResponse = await managedAddressCache.fetch();

    if (cacheFetchResponse.isFailure()) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_cu_fu_2',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    const response = cacheFetchResponse.data[userUuid];

    if (!response) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_cu_fu_3',
        api_error_identifier: 'resource_not_found',
        debug_options: {}
      }));
    }

    if (response['client_id'] != clientId) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_cu_eu_3',
        api_error_identifier: 'unauthorized_for_other_client',
        debug_options: {}
      }));
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

    const userEntityData = {
      uuid: userUuid,
      name: name,
      address: ethereumAddress,
      total_airdropped_tokens: basicHelper.convertToNormal(totalAirdroppedTokens).toString(10),
      token_balance: basicHelper.convertToNormal(tokenBalance).toString(10)
    };

    const userEntityFormatter = new UserEntityFormatterKlass(userEntityData)
        , userEntityFormatterRsp = await userEntityFormatter.perform()
    ;

    const apiResponseData = {
      result_type: 'user',
      user: userEntityFormatterRsp.data
    };

    return Promise.resolve(responseHelper.successWithData(apiResponseData));

  }

};

module.exports = fetchUserKlass;