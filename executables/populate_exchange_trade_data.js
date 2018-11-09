'use strict';

/**
 * This script populates the trade data from binance exchange using - lib/price_stabilization/populate_exchange_trade_data.js
 *
 *
 * Usage: node ./executables/populate_exchange_trade_data.js --pageLimit pageLimit
 *
 * Command Line Parameters Description:
 * [duration] in minutes duration for which we should go back in time to fetch orders
 * Note- If duration is not passed then default value is set to 10 Minutes.
 *
 * Example: node ./executables/populate_exchange_trade_data.js --pageLimit 1000 --duration 100
 *
 * @module
 */

const rootPrefix = '..',
  program = require('commander'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  PopulateExchangeTradeDataKlass = require(rootPrefix + '/lib/price_stabilization/populate_exchange_trade_data');

program.option('--duration <duration>', 'duration');

program.parse(process.argv);

program.on('--help', () => {
  console.log('');
  console.log('  Example:');
  console.log('');
  console.log('    node ./executables/populate_exchange_trade_data.js --duration 10');
  console.log('');
  console.log('');
});

const populate = function() {
  const populateExchangeTradeDataObj = new PopulateExchangeTradeDataKlass({ duration: program.duration });

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
