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
  BinanceWrapper = require(rootPrefix + '/lib/exchange_apis/binance');

const PopulateExchangeTradeDataKlass = function(params) {
  const oThis = this;

  //oThis.basketSizeInUSD = params[''];

  oThis.checkingFrequency = 50; // time (in milliseconds) to check for new trades
};

PopulateExchangeTradeDataKlass.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
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

    let tradingPairs = [],
      columnsNames = [],
      rowToBeInsertedInDB = [],
      queryResponse = await new ExchangeTradingDataModel().showColumns().fire();

    for (let i = 0; i < queryResponse.length; i++) {
      let rowResp = queryResponse[i];
      columnsNames.push(rowResp['Field']);
    }

    //splicing original array to remove these columns -> id, created_at, updated_at
    columnsNames.splice(0, 1);
    columnsNames.splice(-2, 2);

    tradingPairs.push(ExchangeTradeDataConstants.OstBtcTradingPair);
    tradingPairs.push(ExchangeTradeDataConstants.OstEthTradingPair);

    console.log('tradingPairs', tradingPairs);

    for (let i = 0; i < tradingPairs.length; i++) {
      console.log('Current tradingPairs========', tradingPairs[i]);

      let responseFromApi = await BinanceWrapper.fetchRecentTrades(tradingPairs[i], oThis.checkingFrequency);

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
    }

    let queryResponse1 = await new ExchangeTradingDataModel().insertMultiple(columnsNames, rowToBeInsertedInDB).fire();

    Promise.resolve({});
  }
};

//module.exports = PopulateExchangeTradeDataKlass;

const populateExchangeTradeDataObj = new PopulateExchangeTradeDataKlass({});

populateExchangeTradeDataObj
  .perform()
  .then(function(r) {
    logger.win('\n===========Done==========');
    process.exit(0);
  })
  .catch(function(r) {
    logger.error('\n=======Error=========: ', r);
    process.exit(1);
  });
