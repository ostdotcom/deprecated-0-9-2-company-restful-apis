'use strict';

/*
 * wrapper to interact with Binance API's
 *
 * * Author: Dhananjay
 * * Date: 02/11/2018
 * * Reviewed by:
 */

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ExchangeTradeDataConstants = require(rootPrefix + '/lib/global_constant/exchange_trade_data');

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
  fetchAPIRateLimits: function() {
    return new Promise(async function(onResolve, onReject) {
      binanceApiClient.exchangeInfo((error, response) => {
        logger.debug(`exchangeInfo of: ${response}`);
        onResolve(response['rateLimits']);
      });
    });
  },

  fetchCurrentPrice: function(trading_pair) {
    return new Promise(async function(onResolve, onReject) {
      binanceApiClient.prices(trading_pair, (error, response) => {
        if (error) {
          logger.error(`Failed to fetch price for ${trading_pair}`);
          onReject(error);
        } else {
          logger.debug(`Price of ${trading_pair}: ${response[trading_pair]}`);
          onResolve(response[trading_pair]);
        }
      });
    });
  },

  /**
   *
   * @param trading_pair
   *
   * uasge - https://api.binance.com/api/v3/myTrades
   * @returns {Promise<any>}
   */
  fetchTrades: function(trading_pair) {
    return new Promise(async function(onResolve, onReject) {
      binanceApiClient.trades(trading_pair, (error, response, symbol) => {
        if (error) {
          logger.error(`Failed to fetch trade history for ${trading_pair}`);
          onReject(error);
        } else {
          logger.debug(`Trade history for ${trading_pair}: ${response[trading_pair]}`);
          onResolve(response);
        }
      });
    });
  },

  /**
   *
   * @param trading_pair
   * @param page_limit
   *
   * usage - https://api.binance.com/api/v1/trades?symbol=OSTETH&limit=5
   * @returns {Promise<any>}
   */
  fetchRecentTrades: function(trading_pair, page_limit) {
    return new Promise(async function(onResolve, onReject) {
      binanceApiClient.recentTrades(
        trading_pair,
        (error, response) => {
          if (error) {
            logger.error(`Failed to fetch trades for ${trading_pair}`);
            onReject(error);
          } else {
            logger.debug(`Trades for ${trading_pair} fetched successfully.`);
            onResolve(response);
          }
        },
        page_limit
      );
    });
  }
};

module.exports = BinanceApiWrapper;
