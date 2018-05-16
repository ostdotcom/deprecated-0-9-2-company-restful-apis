"use strict";

const rootPrefix = '../../..'
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
    , EconomyUserBalanceKlass = require(rootPrefix + '/lib/economy_user_balance')
    , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
    , UserEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/user')
    , basicHelper = require(rootPrefix + '/helpers/basic')
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
  oThis.clientId = params.client_id;

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

    if (!basicHelper.isUuidValid(oThis.userUuid)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_cu_fu_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id_user'],
        debug_options: {}
      }));
    }

    var managedAddressCache = new ManagedAddressCacheKlass({'uuids': [oThis.userUuid]});

    const cacheFetchResponse = await managedAddressCache.fetch();

    if (cacheFetchResponse.isFailure()) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_cu_fu_3',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    const response = cacheFetchResponse.data[oThis.userUuid];

    if (!response) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_cu_fu_4',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id_user'],
        debug_options: {}
      }));
    }

    if (response['client_id'] != oThis.clientId) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_cu_fu_5',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_id_user'],
        debug_options: {}
      }));
    }

    const ethereumAddress = response['ethereum_address']
        , economyUserBalance = new EconomyUserBalanceKlass({client_id: oThis.clientId, ethereum_addresses: [ethereumAddress]})
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
      uuid: oThis.userUuid,
      name: response['name'],
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