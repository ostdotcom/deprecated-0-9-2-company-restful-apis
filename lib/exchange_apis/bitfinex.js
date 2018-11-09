'use strict';
/*
 * Wrapper to interact with CCXT APIs for Bitfinex
 *
 * * Author: Dhananjay
 * * Date: 02/11/2018
 * * Reviewed by:
 */

const ccxt = require('ccxt');

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

const bitfinex = new ccxt.bitfinex({ verbose: true });

const ccxtWrapperForBitrex = {
  /**
   * bitfinex.fetchTrades('BTC/USDT')
   * https://api.bitfinex.com/v1/trades/BTCUSD?limit_trades=50
   * @param coinSymbol
   * @param timeInterval : timestamp (in ms) after which orders are to be fetched
   * @param limit
   * @returns {Promise<>}
   */
  fetchRecentTrades: function(coinSymbol, timeInterval, limit) {
    const oThis = this;

    if (!timeInterval) {
      timeInterval = bitfinex.milliseconds() - 60000; // default to last 10 min orders
    }

    return new Promise(async function(onResolve, onReject) {
      bitfinex
        .fetchTrades(coinSymbol, timeInterval, limit)
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
      internal_error_identifier: 'l_ea_c_1',
      api_error_identifier: 'something_went_wrong',
      debug_options: { err: error }
    });
  },

  _successResponseHandler: function(successData) {
    logger.debug(successData);
    return responseHelper.successWithData(successData);
  }
};

module.exports = ccxtWrapperForBitrex;
