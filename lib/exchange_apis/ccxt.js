'use strict';
/*
 * Wrapper to interact with CCXT APIs
 *
 * * Author: Dhananjay
 * * Date: 02/11/2018
 * * Reviewed by:
 */

const ccxt = require('ccxt');

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

const kraken = new ccxt.kraken();
const bitfinex = new ccxt.bitfinex({ verbose: true });

const ccxtWrapper = {
  /*loadMarkets: function(coinSymbol, fiatSymbol) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      let m1 = await kraken.loadMarkets();
      logger.log('=======m1=====', m1);

      let m2 = await bitfinex.loadMarkets();
      logger.log('=======m2======', m2);
    });
  },*/

  fetchTradesFromKraken: function(coinSymbol, limit) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      kraken
        .fetchTrades({ symbol: coinSymbol, limit: limit })
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
   * bitfinex.fetchTrades('BTC/USDT')
   * https://api.bitfinex.com/v1/trades/BTCUSD?limit_trades=50
   * @param coinSymbol
   * @param limit
   * @returns {Promise<>}
   */
  fetchTradesFromBitfinex: function(coinSymbol, limit) {
    const oThis = this;

    let timeInterval = bitfinex.milliseconds() - 86400000;

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

module.exports = ccxtWrapper;
