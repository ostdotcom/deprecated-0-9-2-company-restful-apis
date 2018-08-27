'use strict';

/**
 * Update price oracle price points
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
  config_file_path = args[2],
  configStrategy = require(config_file_path);

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

    configStrategy.OST_UTILITY_PRICE_ORACLES = JSON.parse(configStrategy.OST_UTILITY_PRICE_ORACLES);

    if (Object.keys(configStrategy.OST_UTILITY_PRICE_ORACLES).length === 0) {
      throw 'Price oracle contracts not defined';
    }

    for (var baseCurrency in configStrategy.OST_UTILITY_PRICE_ORACLES) {
      console.log('====baseCurrency', configStrategy.OST_UTILITY_PRICE_ORACLES[baseCurrency]);
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
