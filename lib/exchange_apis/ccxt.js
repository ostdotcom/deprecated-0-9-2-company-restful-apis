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
  loadMarkets: function(coinSymbol, fiatSymbol) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      let m1 = await kraken.loadMarkets();
      logger.log('=======m1=====', m1);

      let m2 = await bitfinex.loadMarkets();
      logger.log('=======m2======', m2);
    });
  },

  fetchTradesFromKraken: function(coinSymbol, fiatSymbol) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      let a = await kraken.fetchTrades('USDT/USD', 10, 5);
      logger.log('=====a=====', a);
    });
  },
  fetchOrderBookFromKraken: function(coinSymbol, fiatSymbol) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      let b = await kraken.fetchOrderBook('USDT/USD', 10, 5);
      logger.log('======b=====', b);
    });
  },

  /**
   * bitfinex.fetchTrades('BTC/USDT')
   * https://api.bitfinex.com/v1/trades/BTCUSD?limit_trades=50
   * @param coinSymbol
   * @param fiatSymbol
   * @returns {Promise<any>}
   */
  fetchTradesFromBitfinex: function(coinSymbol, fiatSymbol) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      let a = await bitfinex.fetchTrades('BTC/USDT', 10, 5);
      logger.log('=====a=====', a);
    });
  },

  /**
   * bitfinex.fetchOrderBook('BTC/USDT');
   * https://api.bitfinex.com/v1/book/BTCUSD
   * @param coinSymbol
   * @param fiatSymbol
   * @returns {Promise<any>}
   */
  fetchOrderBookFromBitfinex: function(coinSymbol, fiatSymbol) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      let b = await bitfinex.fetchOrderBook('BTC/USDT', 10, 5);
      logger.log('======b=====', b);
    });
  }
};

module.exports = ccxtWrapper;
