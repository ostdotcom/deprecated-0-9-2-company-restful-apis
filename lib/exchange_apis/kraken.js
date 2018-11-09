'use strict';
/*
 * Wrapper to interact with CCXT APIs
 *
 * * Author: Dhananjay
 * * Date: 02/11/2018
 * * Reviewed by:
 */

const ccxt = require('ccxt');

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

const kraken = new ccxt.kraken({ verbose: true });

const ccxtWrapperForKraken = {
  fetchRecentTrades: function(coinSymbol, limit) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      kraken
        .fetchTrades({ symbol: coinSymbol, limit: limit })
        .then(function(response) {
          let customSuccessRsp = oThis._successResponseHandler(response);
          onResolve(customSuccessRsp);
        })
        .catch(function(error) {
          let customErrorObj = oThis._errorResponseHandler(error);
          onReject(customErrorObj);
        });
    });
  },

  _errorResponseHandler: function(error) {
    logger.error(error);
    return responseHelper.error({
      internal_error_identifier: 'l_ea_c_1',
      api_error_identifier: 'something_went_wrong',
      debug_options: { err: error }
    });
  },

  _successResponseHandler: function(successData) {
    logger.debug(successData);
    return responseHelper.successWithData(successData);
  }
};

module.exports = ccxtWrapperForKraken;
