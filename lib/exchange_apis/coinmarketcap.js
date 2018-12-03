'use strict';

/*
 * Wrapper to interact with CoinMarketCap APIs
 *
 * * Author: Dhananjay
 * * Date: 02/11/2018
 * * Reviewed by:
 */

const CoinMarketCap = require('coinmarketcap-api');

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

const coinMarketCapApiClient = new CoinMarketCap(coreConstants.COINMARKETCAP_API_KEY);

const CoinMarketCapApiWrapper = {
  /**
   * Get latest market quote for 1 or more cryptocurrencies.
   *
   * @param {array} coinSymbol - coin symbol for cryptocurrencies.
   * @param {string} fiatSymbol - currency (FIAT) symbol in which we want to convert.
   *
   * usage - https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=USDT&convert=USD
   * @returns {Promise<>}
   */
  fetchLatestQuotes: function(coinSymbol, fiatSymbol) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      coinMarketCapApiClient
        .getQuotes({ symbol: coinSymbol, convert: fiatSymbol })
        .then(function(response) {
          let customSuccessRsp = oThis._successResponseHandler(response);
          onResolve(customSuccessRsp);
        })
        .catch(function(error) {
          let customErrorObj = oThis._errorResponseHandler(error);
          onReject(customErrorObj);
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
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      coinMarketCapApiClient
        .getMetadata({ symbol: coinSymbol })
        .then(function(response) {
          let customSuccessRsp = oThis._successResponseHandler(response);
          onResolve(customSuccessRsp);
        })
        .catch(function(error) {
          let customErrorObj = oThis._errorResponseHandler(error);
          onReject(customErrorObj);
        });
    });
  },

  _errorResponseHandler: function(error) {
    logger.error(error);
    return responseHelper.error({
      internal_error_identifier: 'l_ea_b_1',
      api_error_identifier: 'something_went_wrong',
      debug_options: { err: error }
    });
  },

  _successResponseHandler: function(successData) {
    logger.debug(successData);
    return responseHelper.successWithData(successData);
  }
};

module.exports = CoinMarketCapApiWrapper;
