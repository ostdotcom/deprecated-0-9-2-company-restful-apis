"use strict";

const rootPrefix = '../../..'
    , ClientBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
    , ostPriceCacheKlass = require(rootPrefix + '/lib/cache_management/ost_price_points')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , basicHelper = require(rootPrefix + '/helpers/basic')
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/**
 *
 * @constructor
 *
 * @param {object} params - this is object with keys.
 * @param {integer} params.client_id - client_id for which users are to be fetched
 *
 */
const GetBrandedTokenKlass = function (params) {

  const oThis = this;

  oThis.clientId = params.client_id;

}

GetBrandedTokenKlass.prototype = {

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
              internal_error_identifier: 's_tm_g_1',
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

    const oThis = this
        , clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({clientId: oThis.clientId})
        , clientBrandedTokenResponse = await clientBrandedTokenCache.fetch()
        , ostPrices = await new ostPriceCacheKlass().fetch()
        , responseData = {result_type: 'token'}
    ;

    if (clientBrandedTokenResponse.isFailure()) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'am_dt_ta_b_1',
        api_error_identifier: 'something_went_wrong',
        debug_options: {},
        error_config: errorConfig
      }));
    }

    const tokenData = clientBrandedTokenResponse.data;

    responseData[responseData.result_type] = {
      company_uuid: tokenData.client_id,
      name: tokenData.name,
      symbol: tokenData.symbol,
      symbol_icon: tokenData.symbol_icon,
      conversion_factor: tokenData.conversion_factor,
      token_erc20_address: tokenData.token_erc20_address,
      airdrop_contract_address: tokenData.airdrop_contract_addr,
      simple_stake_contract_address: tokenData.simple_stake_contract_addr,
      total_supply: '', // TODO: confirm and these
      ost_utility_balance: []
    }

    responseData.price_points = ostPrices.data;

    return Promise.resolve(responseHelper.successWithData(responseData));

  }

}


module.exports = GetBrandedTokenKlass;