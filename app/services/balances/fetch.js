"use strict";

/**
 * Fetch the user balance
 *
 * @module app/services/balances/fetch
 */

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ManagedAddressesCache = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , ClientBrandedTokenCache = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , EconomyUserBalance = require(rootPrefix + '/lib/economy_user_balance')
;


const Fetch = function(params) {
  const oThis = this
  ;

  oThis.user_uuid = params.id;
  oThis.clientId = params.client_id;

};

Fetch.prototype = {

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  perform: function() {
    const oThis = this
    ;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error({
            internal_error_identifier: 's_b_f_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  /**
   * asyncPerform
   * @return {Promise}
   */
  asyncPerform: async function() {
    const oThis = this
    ;

    await oThis.validateAndSanitize();

    await oThis.getBalanceFetchParams();

    let r = await oThis.getBalance();

    if (r.isFailure()) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_b_f_4',
        api_error_identifier: 'error_getting_balance',
        debug_options: {}
      }));
    }

    return responseHelper.successWithData(r.data);
  },

  /**
   * validateAndSanitize
   *
   */
  validateAndSanitize: async function() {
    const oThis = this
    ;

    if (!basicHelper.isUuidValid(oThis.user_uuid)) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_b_f_2',
        api_error_identifier: 'resource_not_found',
        params_error_identifiers: ['invalid_id'],
        debug_options: {}
      }));
    }

    return responseHelper.successWithData({});
  },

  /**
   * getBalanceFetchParams
   *
   * @return {Promise}
   */
  getBalanceFetchParams: async function() {
    const oThis = this
    ;

    let managedAddressesCacheResponse = await new ManagedAddressesCache({
      uuids: [oThis.user_uuid]
    }).fetch();

    if (!managedAddressesCacheResponse.data[oThis.user_uuid]) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_b_f_3',
        api_error_identifier: 'resource_not_found',
        debug_options: {}
      }));
    }

    oThis.ethereumAddress = managedAddressesCacheResponse.data[oThis.user_uuid].ethereum_address;
    let clientId = managedAddressesCacheResponse.data[oThis.user_uuid].client_id;

    if (clientId != oThis.clientId) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_b_f_4',
        api_error_identifier: 'resource_not_found',
        debug_options: {}
      }));
    }


    let clientBrandedTokenCacheResponse = await new ClientBrandedTokenCache({
      clientId: oThis.clientId
    }).fetch();

    oThis.erc20ContractAddress = clientBrandedTokenCacheResponse.data.token_erc20_address;

  },

  /**
   * getBalance
   *
   */
  getBalance: async function() {
    const oThis = this
    ;

    let economyUserBalanceResponse = await new EconomyUserBalance({
      client_id: oThis.clientId,
      ethereum_addresses: [oThis.ethereumAddress]
    }).perform();

    let finalResponse = {};
    finalResponse.available_balance = economyUserBalanceResponse.data[oThis.ethereumAddress].availableBalance.toString(10);
    finalResponse.airdropped_balance = economyUserBalanceResponse.data[oThis.ethereumAddress].balanceAirdropAmount.toString(10);

    return responseHelper.successWithData(finalResponse);
  }

};

module.exports = Fetch;