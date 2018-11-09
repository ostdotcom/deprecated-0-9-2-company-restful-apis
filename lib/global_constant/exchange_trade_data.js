'use strict';

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util');

const exchangeTradeData = {
  // Exchanges

  binanceExchange: 'binance',

  bitrexExchange: 'bitrex',

  coinmarketcapExchange: 'coinmarketcap',

  // Trading Pairs

  OstEthTradingPair: 'OSTETH',

  OstBtcTradingPair: 'OSTBTC',

  UsdtUsdTradingPair: 'USDTUSD',

  BtcUsdTradingPair: 'BTCUSD',

  EthUsdTradingPair: 'ETHUSD',

  // Currency Symbols
  usd: 'USD',

  usdt: 'USDT'
};

const exchanges = {
    '1': exchangeTradeData.binanceExchange,
    '2': exchangeTradeData.coinmarketcapExchange,
    '3': exchangeTradeData.bitrexExchange
  },
  invertedExchanges = util.invert(exchanges);

const tradingPairs = {
    '1': exchangeTradeData.OstEthTradingPair,
    '2': exchangeTradeData.OstBtcTradingPair,
    '3': exchangeTradeData.UsdtUsdTradingPair,
    '4': exchangeTradeData.BtcUsdTradingPair,
    '5': exchangeTradeData.EthUsdTradingPair
  },
  invertedTradingPairs = util.invert(tradingPairs);

exchangeTradeData.exchanges = exchanges;
exchangeTradeData.tradingpairs = tradingPairs;
exchangeTradeData.invertedExchanges = invertedExchanges;
exchangeTradeData.invertedTradingpairs = invertedTradingPairs;

module.exports = exchangeTradeData;
