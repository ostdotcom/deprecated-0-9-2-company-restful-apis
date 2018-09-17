'use strict';
/**
 * This script will update price oracle price points using ost-price-oracle npm package.
 * This fetches OST Current price in given currency from coin market cap and sets it in price oracle.
 *
 * Usage: node executables/update_price_oracle_price_points.js configStrategyFilePath
 *
 * Command Line Parameters Description:
 * configStrategyFilePath: config strategy file to fetch OST_PRICE_ORACLES
 *
 * Example: node executables/update_price_oracle_price_points.js ~/config.js
 *
 * @module executables/update_price_oracle_price_points
 */

const rootPrefix = '..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

const conversionRateConstants = require(rootPrefix + '/lib/global_constant/conversion_rates'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/app/services/conversion_rates/update_ost_fiat_rates_in_price_oracle');

const args = process.argv,
  configStrategyFilePath = args[2];

let configStrategy = {};

// Usage demo.
const usageDemo = function() {
  logger.log('usage:', 'node executables/update_price_oracle_price_points.js config_file_path');
  logger.log('* config Strategy FilePath is the path to the file which is storing the config strategy info.');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!configStrategyFilePath) {
    logger.error('Config strategy file path is NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  configStrategy = require(configStrategyFilePath);
};

// Validate and sanitize the input params.
validateAndSanitize();

/**
 * Update price oracle price points constructor
 *
 * @constructor
 */
const UpdatePriceOraclePricePoints = function() {
  const oThis = this;
};

UpdatePriceOraclePricePoints.prototype = {
  perform: async function() {
    const oThis = this,
      instanceComposer = new InstanceComposer(configStrategy);

    if (Object.keys(configStrategy.OST_UTILITY_PRICE_ORACLES).length === 0) {
      throw 'Price oracle contracts not defined';
    }

    for (var baseCurrency in configStrategy.OST_UTILITY_PRICE_ORACLES) {
      logger.log('====baseCurrency', configStrategy.OST_UTILITY_PRICE_ORACLES[baseCurrency]);
      if (baseCurrency == conversionRateConstants.ost_currency()) {
        var quoteCurrencies = configStrategy.OST_UTILITY_PRICE_ORACLES[baseCurrency];
        for (var quoteCurrency in quoteCurrencies) {
          if (quoteCurrency == conversionRateConstants.usd_currency()) {
            logger.step("Updating quote currency '" + quoteCurrency + "' in base currency '" + baseCurrency + "'");

            var ostPriceUpdater = instanceComposer.getUpdateOstFiatInPriceOracleClass();
            await new ostPriceUpdater({ currency_code: 'USD' }).perform();

            process.exit(0);
          } else {
            throw "Unhandled quote currency '" + quoteCurrency + "' in base currency '" + baseCurrency + "'";
          }
        }
      } else {
        throw "Unhandled base currency '" + baseCurrency + "'";
      }
    }
  }
};

// perform action
const UpdatePriceOraclePricePointObj = new UpdatePriceOraclePricePoints();
UpdatePriceOraclePricePointObj.perform();
