'use strict';

/**
 * This script populates the trade data from binance exchange using - lib/price_stabilization/populate_exchange_trade_data.js
 *
 *
 * Usage: node ./executables/populate_exchange_trade_data_from_binance.js --pageLimit pageLimit
 *
 * Command Line Parameters Description:
 * [pageLimit]: Group id for fetching the config strategy (Optional)
 * Note- If page limit is not passed then default value is set to max value i.e. 1000.
 *
 * Example: node ./executables/populate_exchange_trade_data_from_binance.js --pageLimit 1000
 *
 * @module
 */

const rootPrefix = '..',
  program = require('commander'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  PopulateExchangeTradeDataKlass = require(rootPrefix + '/lib/price_stabilization/populate_exchange_trade_data');

program.option('--pageLimit [pageLimit]', 'Page Limit').parse(process.argv);

program.on('--help', () => {
  console.log('');
  console.log('  Example:');
  console.log('');
  console.log('    node ./executables/populate_exchange_trade_data_from_binance.js --pageLimit 1000 ');
  console.log('');
  console.log('');
});

const populate = function() {
  const populateExchangeTradeDataObj = new PopulateExchangeTradeDataKlass({ pageLimit: program.pageLimit });

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
};

populate();
