'use strict';

/**
 * to collect price data for different currencies using exchange APIs.
 *
 * @module
 */

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ExchangeTradeDataConstants = require(rootPrefix + '/lib/global_constant/exchange_trade_data'),
  ExchangePriceDataModel = require(rootPrefix + '/app/models/exchange_price_data'),
  BinanceWrapper = require(rootPrefix + '/lib/exchange_apis/binance'),
  CoinMarketCapWrapper = require(rootPrefix + '/lib/exchange_apis/coinmarketcap');

const PopulatePriceDataKlass = function(params) {
  const oThis = this;
};

PopulatePriceDataKlass.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`lib/price_stabilization/populate_prices.js::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'l_ps_pp_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   *
   * @return {Promise}
   *
   */
  asyncPerform: async function() {
    const oThis = this;

    oThis.currentTimestamp = new Date().getTime();

    await oThis.fetchOstEthPrice();

    await oThis.fetchOstBtcPrice();

    await oThis.fetchUsdtPrice();

    return Promise.resolve({});
  },

  fetchOstEthPrice: async function() {
    const oThis = this;

    let responseOfOstEth = await BinanceWrapper.fetchCurrentPrice(ExchangeTradeDataConstants.OstEthTradingPair),
      priceOfOstEth = responseOfOstEth.data;

    let queryRspOfOstEth = await new ExchangePriceDataModel()
      .insert({
        trading_pair: ExchangeTradeDataConstants.invertedTradingpairs[ExchangeTradeDataConstants.OstEthTradingPair],
        timestamp: oThis.currentTimestamp,
        price: priceOfOstEth,
        exchange: ExchangeTradeDataConstants.invertedExchanges[ExchangeTradeDataConstants.binanceExchange]
      })
      .fire();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  fetchOstBtcPrice: async function() {
    const oThis = this;

    let responseOfOstBtc = await BinanceWrapper.fetchCurrentPrice(ExchangeTradeDataConstants.OstBtcTradingPair),
      priceOfOstBtc = responseOfOstBtc.data;

    let queryRspOfOstBtc = await new ExchangePriceDataModel()
      .insert({
        trading_pair: ExchangeTradeDataConstants.invertedTradingpairs[ExchangeTradeDataConstants.OstBtcTradingPair],
        timestamp: oThis.currentTimestamp,
        price: priceOfOstBtc,
        exchange: ExchangeTradeDataConstants.invertedExchanges[ExchangeTradeDataConstants.binanceExchange]
      })
      .fire();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  fetchUsdtPrice: async function() {
    const oThis = this;

    let usdt = ExchangeTradeDataConstants.usdt,
      usd = ExchangeTradeDataConstants.usd,
      responseFromCMCApi = await CoinMarketCapWrapper.fetchLatestQuotes(usdt, usd),
      dataFromCMCApi = responseFromCMCApi.data,
      quotesData = dataFromCMCApi.data[usdt],
      priceInfo = quotesData.quote[usd],
      priceInUsd = priceInfo.price;

    let queryRsp = await new ExchangePriceDataModel()
      .insert({
        trading_pair: ExchangeTradeDataConstants.invertedTradingpairs[ExchangeTradeDataConstants.UsdtUsdTradingPair],
        timestamp: oThis.currentTimestamp,
        price: priceInUsd,
        exchange: ExchangeTradeDataConstants.invertedExchanges[ExchangeTradeDataConstants.coinmarketcapExchange]
      })
      .fire();

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

module.exports = PopulatePriceDataKlass;
