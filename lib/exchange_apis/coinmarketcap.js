'use strict';

/*
 * wrapper to interact with CoinMarketCap APIs
 *
 * * Author: Dhananjay
 * * Date: 02/11/2018
 * * Reviewed by:
 */

const CoinMarketCap = require('coinmarketcap-api');

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ExchangeTradeDataConstants = require(rootPrefix + '/lib/global_constant/exchange_trade_data');

const apiKey = '53cc1e97-468e-4ff1-913d-cfbcf22110c1';
const coinMarketCapApiClient = new CoinMarketCap(apiKey);

const coinMarketCapApiWrapper = {
  /**
   * Get latest market quote for 1 or more cryptocurrencies.
   * @param {array} coinSymbol - coin symbol for cryptocurrencies.
   * @param {string} fiatSymbol - currency (FIAT) symbol in which we want to convert coin price.
   *
   * usage - https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=825&convert=USD
   * @returns {Promise<>}
   */
  fetchLatestQuotes: function(coinSymbol, fiatSymbol) {
    return new Promise(async function(onResolve, onReject) {
      coinMarketCapApiClient
        .getQuotes({ symbol: coinSymbol, convert: fiatSymbol })
        .then(function(response) {
          logger.debug(`Fetched value for ${coinSymbol} in ${fiatSymbol}: ${JSON.stringify(response.data)}`);
          onResolve(response);
        })
        .catch(function(error) {
          logger.log('Failed to fetch current value.');
          onReject(error);
        });
    });
  },

  /**
   * Get static metadata for one or more cryptocurrencies.
   * Either id or symbol is required, but passing in both is not allowed.
   *
   * @param {array} coinSymbol - coin symbol for cryptocurrencies.
   * @returns {Promise<>}
   */
  fetchCoinInfo: function(coinSymbol) {
    return new Promise(async function(onResolve, onReject) {
      coinMarketCapApiClient
        .getMetadata({ symbol: coinSymbol })
        .then(function(response) {
          logger.debug(`Fetched value for ${coinSymbol}: ${JSON.stringify(response.data)}`);
          onResolve(response);
        })
        .catch(function(error) {
          logger.log('Failed to fetch current value.');
          onReject(error);
        });
    });
  },

  fetchTickers: function(coinSymbol) {
    return new Promise(async function(onResolve, onReject) {
      coinMarketCapApiClient
        .getTickers({ convert: 'USD' })
        .then(function(response) {
          logger.debug(`Fetched value for : ${JSON.stringify(response.data)}`);
          onResolve(response);
        })
        .catch(function(error) {
          logger.log('Failed to fetch current value.');
          onReject(error);
        });
    });
  }
};

module.exports = coinMarketCapApiWrapper;
