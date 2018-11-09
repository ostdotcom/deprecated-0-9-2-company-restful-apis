'use strict';

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util');

const exchangeTradeData = {
  // Exchanges

  binanceExchange: 'binance',

  coinmarketcapExchange: 'coinmarketcap',

  // Trading Pairs

  OstEthTradingPair: 'OSTETH',

  OstBtcTradingPair: 'OSTBTC',

  UsdtUsdTradingPair: 'USDTUSD',

  // Currency Symbols
  usd: 'USD',

  usdt: 'USDT',

  // Pairs for ccxt exchange

  BtcUsdTradingPair: 'BTC/USD',

  EthUsdTradingPair: 'ETH/USD'
};

const exchanges = {
    '1': exchangeTradeData.binanceExchange,
    '2': exchangeTradeData.coinmarketcapExchange
  },
  invertedExchanges = util.invert(exchanges);

const tradingPairs = {
    '1': exchangeTradeData.OstEthTradingPair,
    '2': exchangeTradeData.OstBtcTradingPair,
    '3': exchangeTradeData.UsdtUsdTradingPair
  },
  invertedTradingPairs = util.invert(tradingPairs);

exchangeTradeData.exchanges = exchanges;
exchangeTradeData.tradingpairs = tradingPairs;
exchangeTradeData.invertedExchanges = invertedExchanges;
exchangeTradeData.invertedTradingpairs = invertedTradingPairs;

module.exports = exchangeTradeData;
