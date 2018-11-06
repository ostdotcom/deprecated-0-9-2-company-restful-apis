'use strict';

/**
 * This executable script populates the daily price data from following exchanges.
 * 1. Binance - for OST/ETH price and OST/BTC price
 * 2. CoinMarket Cap - for USDT/USD price
 *
 * it uses - lib/price_stabilization/populate_prices.js
 *
 * Usage: node ./executables/populate_exchange_price_data.js
 *
 * @module
 */

const rootPrefix = '..',
  program = require('commander'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  PopulateExchangePriceDataKlass = require(rootPrefix + '/lib/price_stabilization/populate_prices');

const populate = function() {
  const populatePriceTradeDataObj = new PopulateExchangePriceDataKlass();

  populatePriceTradeDataObj
    .perform()
    .then(function(r) {
      logger.win('\n===========Done==========');
      process.exit(0);
    })
    .catch(function(r) {
      logger.error('\n=======Error=========: ', r);
      process.exit(1);
    });
};

populate();
