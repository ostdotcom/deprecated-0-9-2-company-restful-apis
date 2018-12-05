'use strict';

/**
 * For rebalancing and price stabilization, first step is to collect data from certain exhanges using their APIs.
 *
 * @module
 */

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const RebalancePortfolio = function(params) {
  const oThis = this;

  oThis.basketSizeInUSD = params[''];
  oThis.idealBasketComposition = params['']; // hash like {'OST': 10, 'ETH': '20', 'USDT': '70'}
  oThis.acceptableDeviation = params[''];
  oThis.currentBasketComposition = params[''];
};

RebalancePortfolio.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'l_ps_rp_1',
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
  asyncPerform: async function() {}
};

module.exports = RebalancePortfolio;
