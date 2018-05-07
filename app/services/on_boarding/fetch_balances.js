"use strict";

/**
 * Fetch Balances from Utility And / OR Value Chain depending on params
 *
 * @module app/services/on_boarding/fetch_balances
 *
 */

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ucBalanceFetcherKlass = require(rootPrefix + '/app/services/address/utilityChainBalancesFetcher')
  , vcBalanceFetcherKlass = require(rootPrefix + '/app/services/address/valueChainBalancesFetcher')
  , ostPriceCacheKlass = require(rootPrefix + '/lib/cache_management/ost_price_points')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/**
 * Fetch Params using which FE could interact with our chains
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom users are to be created.
 * @param {object} params.balances_to_fetch - object having details about which balances are to be fetched
 *
 */
const FetchBalances = function (params) {

  this.clientId = params.client_id;
  this.balancesToFetch = params.balances_to_fetch

};

FetchBalances.prototype = {

  perform: function(){
    const oThis = this;

    return oThis.aysncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 'ob_fb_3',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      })
  },

  /**
   * Perform<br><br>
   *
   * @return {result} - returns an object of Result
   *
   */
  aysncPerform: async function () {

    const oThis = this;

    if (!oThis.clientId) {
      return Promise.resolve(responseHelper.paramValidationError({
        internal_error_identifier: 'ob_fb_1',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['missing_client_id'],
        debug_options: {}
      }));
    }

    if (!oThis.balancesToFetch) {
      return Promise.resolve(responseHelper.paramValidationError({
        internal_error_identifier: 'ob_fb_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['missing_balances_to_fetch'],
        debug_options: {}
      }));
    }

    var ostPrices = await new ostPriceCacheKlass().fetch();
    var promisesArray = []
      , responseData = {
      'oracle_price_points': ostPrices.data,
      balances: {}
    };

    if (oThis.balancesToFetch.value) {
      var params = Object.assign(oThis.balancesToFetch.value, {client_id: oThis.clientId});
      var vcBalanceFetcher = new vcBalanceFetcherKlass(params);
      promisesArray.push(vcBalanceFetcher.perform());
    }

    if (oThis.balancesToFetch.utility) {
      var params = Object.assign(oThis.balancesToFetch.utility, {client_id: oThis.clientId});
      var ucBalanceFetcher = new ucBalanceFetcherKlass(params);
      promisesArray.push(ucBalanceFetcher.perform());
    }

    var balancesData = await Promise.all(promisesArray);

    for (var i = 0; i < promisesArray.length; i++) {

      var balanceData = balancesData[i];

      if (balanceData.isSuccess()) {

        Object.assign(responseData.balances, balanceData.data)

      }

    }

    logger.log(JSON.stringify(responseData));

    return Promise.resolve(responseHelper.successWithData(responseData));

  }

};

module.exports = FetchBalances;