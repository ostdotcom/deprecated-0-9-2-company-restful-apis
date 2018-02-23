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

  /**
   * Perform<br><br>
   *
   * @return {result} - returns an object of Result
   *
   */
  perform: async function () {

    const oThis = this;

    if (!oThis.clientId) {
      return Promise.resolve(responseHelper.error('ob_fcip_1', 'missing clientId'));
    }

    if (!oThis.balancesToFetch) {
      return Promise.resolve(responseHelper.error('ob_fcip_2', 'missing balancesToFetch'));
    }

    var promisesArray = []
      , responseData = {
      'oracle_price_points': {
        'ost': {
          'usd': '0.33'
        }
      },
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

    console.log(responseData);

    return Promise.resolve(responseHelper.successWithData(responseData));

  }

};

module.exports = FetchBalances;