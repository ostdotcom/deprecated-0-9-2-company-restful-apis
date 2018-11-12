'use strict';

/**
 * to collect recent trade data using exchange APIs.
 *
 * @module
 */

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ExchangeTradeDataConstants = require(rootPrefix + '/lib/global_constant/exchange_trade_data'),
  ExchangeTradingDataModel = require(rootPrefix + '/app/models/exchange_trade_data'),
  BinanceWrapper = require(rootPrefix + '/lib/exchange_apis/binance'),
  cctxWrapperForBitfinex = require(rootPrefix + '/lib/exchange_apis/bitfinex'),
  cctxWrapperForKraken = require(rootPrefix + '/lib/exchange_apis/kraken'),
  CoinMarketCapWrapper = require(rootPrefix + '/lib/exchange_apis/coinmarketcap');

/**
 * @constructor
 * @param params[duration] : duration (in minutes) after which orders are to be fetched
 */
const PopulateExchangeTradeDataKlass = function(params) {
  const oThis = this;
  oThis.duration = params['duration'] || 10;
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

    await oThis.populateDataFromBifinex();

    await oThis.populateDataFromKraken();

    return Promise.resolve({});
  },

  populateDataFromBinance: async function() {
    const oThis = this;

    let tradingPairs = [ExchangeTradeDataConstants.OstBtcTradingPair, ExchangeTradeDataConstants.OstEthTradingPair];

    for (let i = 0; i < tradingPairs.length; i++) {
      let rowToBeInsertedInDB = [],
        fetchDbTableColumnNamesRsp = await oThis._fetchDbTableColumnNames();

      logger.step('Starting to Fetch Data from Binance for: ', tradingPairs[i]);

      let response = await BinanceWrapper.fetchRecentTrades(tradingPairs[i], 1000),
        responseFromApi = response.data;

      for (let index = 0; index < responseFromApi.length; index++) {
        let rowToBeInserted = responseFromApi[index],
          hashToBeInserted = {},
          extraDataInHash = {};

        hashToBeInserted['exchange'] =
          ExchangeTradeDataConstants.invertedExchanges[ExchangeTradeDataConstants.binanceExchange];
        hashToBeInserted['trading_pair'] = ExchangeTradeDataConstants.invertedTradingpairs[tradingPairs[i]];
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

  populateDataFromBifinex: async function() {
    const oThis = this,
      tradingPairTradingSymbolMap = {},
      pageLimit = 100;

    tradingPairTradingSymbolMap[ExchangeTradeDataConstants.BtcUsdTradingPair] = 'BTC/USDT';
    tradingPairTradingSymbolMap[ExchangeTradeDataConstants.EthUsdTradingPair] = 'ETH/USDT';

    for (let tradingPair in tradingPairTradingSymbolMap) {
      let tradingSymbol = tradingPairTradingSymbolMap[tradingPair],
        timestamp = parseInt(new Date().getTime() - oThis.duration * 60 * 1000);

      while (true) {
        logger.step('Starting to Fetch Data from Bitfinex for: ', tradingSymbol, timestamp);

        let rowToBeInsertedInDB = [],
          fetchDbTableColumnNamesRsp = await oThis._fetchDbTableColumnNames();

        let response = await cctxWrapperForBitfinex.fetchRecentTrades(tradingSymbol, timestamp, pageLimit),
          recentTradesFromApi = response.data;

        // break if failure or 0 trades
        if (response.isFailure() || recentTradesFromApi.length <= 0) {
          break;
        }

        for (let index = 0; index < recentTradesFromApi.length; index++) {
          let recentTradeFromApi = recentTradesFromApi[index],
            hashToBeInserted = {},
            extraDataInHash = {};

          hashToBeInserted['exchange'] =
            ExchangeTradeDataConstants.invertedExchanges[ExchangeTradeDataConstants.bitfinexExchange];
          hashToBeInserted['trading_pair'] = ExchangeTradeDataConstants.invertedTradingpairs[tradingPair];
          hashToBeInserted['trade_id'] = recentTradeFromApi.info.tid;
          hashToBeInserted['timestamp'] = recentTradeFromApi.info.timestamp * 1000; // converting S to MS
          hashToBeInserted['price'] = recentTradeFromApi.info.price;
          hashToBeInserted['quantity'] = recentTradeFromApi.info.amount;

          extraDataInHash['orderType'] = recentTradeFromApi.info.type;

          hashToBeInserted['extra_data'] = JSON.stringify(extraDataInHash);

          rowToBeInsertedInDB.push(Object.values(hashToBeInserted));

          //logger.debug('rowToBeInsertedInDB',rowToBeInsertedInDB);
        }

        await new ExchangeTradingDataModel()
          .insertMultiple(fetchDbTableColumnNamesRsp.data, rowToBeInsertedInDB)
          .onDuplicate('id=id')
          .fire();

        // break if less orders were fetched than pageLimit. imples no next page
        if (recentTradesFromApi.length < pageLimit) {
          break;
        }

        timestamp = recentTradesFromApi[recentTradesFromApi.length - 1].info.timestamp * 1000;
      }
    }
  },

  populateDataFromKraken: async function() {
    const oThis = this,
      tradingPairTradingSymbolMap = {};

    tradingPairTradingSymbolMap[ExchangeTradeDataConstants.UsdtUsdTradingPair] = 'USDT/USD';

    for (let tradingPair in tradingPairTradingSymbolMap) {
      let tradingSymbol = tradingPairTradingSymbolMap[tradingPair];

      let rowToBeInsertedInDB = [],
        fetchDbTableColumnNamesRsp = await oThis._fetchDbTableColumnNames();

      let response = await cctxWrapperForKraken.fetchRecentTrades(tradingSymbol),
        recentTradesFromApi = response.data;

      for (let index = 0; index < recentTradesFromApi.length; index++) {
        let recentTradeFromApi = recentTradesFromApi[index],
          hashToBeInserted = {},
          extraDataInHash = {};

        hashToBeInserted['exchange'] =
          ExchangeTradeDataConstants.invertedExchanges[ExchangeTradeDataConstants.krakenExchange];
        hashToBeInserted['trading_pair'] = ExchangeTradeDataConstants.invertedTradingpairs[tradingPair];
        hashToBeInserted['trade_id'] = null;
        hashToBeInserted['timestamp'] = recentTradeFromApi.timestamp;

        hashToBeInserted['price'] = recentTradeFromApi.price;
        hashToBeInserted['quantity'] = recentTradeFromApi.amount;

        extraDataInHash['info'] = recentTradeFromApi.info;

        if (recentTradeFromApi.id) {
          extraDataInHash['last_id'] = recentTradeFromApi.id;
        }

        hashToBeInserted['extra_data'] = JSON.stringify(extraDataInHash);

        rowToBeInsertedInDB.push(Object.values(hashToBeInserted));
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
};

module.exports = PopulateExchangeTradeDataKlass;
