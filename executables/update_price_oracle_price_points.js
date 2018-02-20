"use strict";

/**
 * Update price oracle price points
 *
 * @module executables/update_price_oracle_price_points
 */

const rootPrefix = ".."
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , conversionRateConstants = require(rootPrefix + "/lib/global_constant/conversion_rates")
  , logger = require(rootPrefix + "/lib/logger/custom_console_logger")
;

/**
 * Update price oracle price points constructor
 *
 * @constructor
 */
const UpdatePriceOraclePricePoints = function () {
  const oThis = this;
};

UpdatePriceOraclePricePoints.prototype = {
  perform: async function() {

    if (Object.keys(chainInteractionConstants.UTILITY_PRICE_ORACLES).length == 0) {
      throw "Price oracle contracts not defined";
    }

    for (var baseCurrency in chainInteractionConstants.UTILITY_PRICE_ORACLES) {
      if (baseCurrency == conversionRateConstants.ost_currency()) {

        var quoteCurrencies = chainInteractionConstants.UTILITY_PRICE_ORACLES[baseCurrency];
        for (var quoteCurrency in quoteCurrencies) {

          if (quoteCurrency == conversionRateConstants.usd_currency()) {

            logger.step("Updating quote currency '" + quoteCurrency + "' in base currency '" + baseCurrency + "'");
            var ostPriceUpdater = require(rootPrefix + '/app/services/conversion_rates/fetch_current_ost_price');
            await new ostPriceUpdater({currency_code: 'USD'}).perform();
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
