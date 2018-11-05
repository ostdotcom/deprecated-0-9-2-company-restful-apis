'use strict';

/*
 * wrapper to interact with Binance APIs
 *
 * * Author: Dhananjay
 * * Date: 02/11/2018
 * * Reviewed by:
 */

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

const binanceApiClient = require('node-binance-api')().options({
  APIKEY: coreConstants.BINANCE_API_KEY,
  APISECRET: coreConstants.BINANCE_API_SECRET,
  useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
  test: true, // If you want to use sandbox mode where orders are simulated
  recvWindow: 60000, // Set a higher recvWindow to increase response timeout
  verbose: true, // Add extra output when subscribing to WebSockets, etc
  log: (log) => {
    logger.log(log);
  }
});

const BinanceApiWrapper = {
  /**
   * Gets the the exchange info
   *
   * @returns {Promise<>}
   */
  fetchAPIRateLimits: function() {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      binanceApiClient.exchangeInfo((error, response) => {
        if (error) {
          let customErrorObj = oThis._errorResponseHandler(error);
          onReject(customErrorObj);
        } else {
          let customSuccessRsp = oThis._successResponseHandler(response['rateLimits']);
          onResolve(customSuccessRsp);
        }
      });
    });
  },

  /**
   * Gets the prices of a given symbol(s)
   * @param {string} trading_pair - the symbol for trading pair
   *
   * @returns {Promise<any>}
   */
  fetchCurrentPrice: function(trading_pair) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      binanceApiClient.prices(trading_pair, (error, response) => {
        if (error) {
          let customErrorObj = oThis._errorResponseHandler(error);
          onReject(customErrorObj);
        } else {
          let customSuccessRsp = oThis._successResponseHandler(response[trading_pair]);
          onResolve(customSuccessRsp);
        }
      });
    });
  },

  /**
   * Get the recent trades
   * @param {string} trading_pair - the symbol for trading pair, eg. - 'OSTBTC'
   * @param page_limit - limit the number of items returned in response
   *
   * usage - https://api.binance.com/api/v1/trades?symbol=OSTETH&limit=5
   * @returns {Promise<>}
   */
  fetchRecentTrades: function(trading_pair, page_limit) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      binanceApiClient.recentTrades(
        trading_pair,
        (error, response) => {
          if (error) {
            let customErrorObj = oThis._errorResponseHandler(error);
            onReject(customErrorObj);
          } else {
            let customSuccessRsp = oThis._successResponseHandler(response);
            onResolve(customSuccessRsp);
          }
        },
        page_limit
      );
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

module.exports = BinanceApiWrapper;
