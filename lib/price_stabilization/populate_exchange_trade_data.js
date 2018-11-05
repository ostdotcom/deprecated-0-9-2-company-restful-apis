'use strict';

/**
 * to collect data from certain exhanges using exchange APIs.
 *
 * @module
 */

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ExchangeTradeDataConstants = require(rootPrefix + '/lib/global_constant/exchange_trade_data'),
  ExchangeTradingDataModel = require(rootPrefix + '/app/models/exchange_trade_data'),
  BinanceWrapper = require(rootPrefix + '/lib/exchange_apis/binance'),
  CoinMarketCapWrapper = require(rootPrefix + '/lib/exchange_apis/coinmarketcap');

const PopulateExchangeTradeDataKlass = function(params) {
  const oThis = this;

  oThis.pageLimit = params['pageLimit'] || 1000;
};

PopulateExchangeTradeDataKlass.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`lib/price_stabilization/populate_exchange_trade_data.js::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'l_ps_petd_1',
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

    await oThis.populateDataFromBinance();

    return Promise.resolve({});
  },

  populateDataFromBinance: async function() {
    const oThis = this;

    let tradingPairs = [ExchangeTradeDataConstants.OstBtcTradingPair, ExchangeTradeDataConstants.OstEthTradingPair];

    for (let i = 0; i < tradingPairs.length; i++) {
      let rowToBeInsertedInDB = [],
        fetchDbTableColumnNamesRsp = await oThis._fetchDbTableColumnNames();

      logger.step('Starting to Fetch Data from Binance for: ', tradingPairs[i]);

      let response = await BinanceWrapper.fetchRecentTrades(tradingPairs[i], oThis.pageLimit),
        responseFromApi = response.data;

      for (let index = 0; index < responseFromApi.length; index++) {
        let rowToBeInserted = responseFromApi[index],
          hashToBeInserted = {},
          extraDataInHash = {};

        hashToBeInserted['exchange'] = ExchangeTradeDataConstants.binanceExchange;
        hashToBeInserted['trading_pair'] = tradingPairs[i];
        hashToBeInserted['trade_id'] = rowToBeInserted.id;

        hashToBeInserted['timestamp'] = rowToBeInserted.time;
        hashToBeInserted['price'] = rowToBeInserted.price;
        hashToBeInserted['quantity'] = rowToBeInserted.qty;

        extraDataInHash['isBuyerMaker'] = rowToBeInserted.isBuyerMaker;
        extraDataInHash['isBestMatch'] = rowToBeInserted.isBestMatch;

        hashToBeInserted['extra_data'] = JSON.stringify(extraDataInHash);

        rowToBeInsertedInDB.push(Object.values(hashToBeInserted));

        //console.log('rowToBeInsertedInDB',rowToBeInsertedInDB);
      }

      await new ExchangeTradingDataModel()
        .insertMultiple(fetchDbTableColumnNamesRsp.data, rowToBeInsertedInDB)
        .onDuplicate('id=id')
        .fire();
    }
  },

  _fetchDbTableColumnNames: async function() {
    const oThis = this,
      columnsNames = [],
      queryResponse = await new ExchangeTradingDataModel().showColumns().fire();

    for (let i = 0; i < queryResponse.length; i++) {
      let rowResp = queryResponse[i];
      columnsNames.push(rowResp['Field']);
    }

    //splicing original array to remove these columns -> id, created_at, updated_at
    columnsNames.splice(0, 1);
    columnsNames.splice(-2, 2);

    return Promise.resolve(responseHelper.successWithData(columnsNames));
  }

  // fetchUsdtPrice: async function() {
  //   const oThis = this;
  //
  //   let usdt = ExchangeTradeDataConstants.usdt,
  //     usd = ExchangeTradeDataConstants.usd,
  //     responseFromCMCApi = await CoinMarketCapWrapper.fetchLatestQuotes(usdt, usd);
  //
  //   let quotesData = responseFromCMCApi.data[usdt],
  //     priceInfo = quotesData.quote[usd],
  //     priceInFiat = priceInfo.price;
  //
  //   logger.log(`Price of ${quotesData.name} in ${usd}: ${JSON.stringify(priceInFiat)}\n\n`);
  // }
};

module.exports = PopulateExchangeTradeDataKlass;
