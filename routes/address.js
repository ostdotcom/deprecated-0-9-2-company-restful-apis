const express = require('express')
  , router = express.Router()
  , rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/* Create Ethereum address with random passphrase */
router.post('/create', function (req, res, next) {
  const performer = function() {
    const decodedParams = req.decodedParams
      , generateAddress = require(rootPrefix + '/app/services/address/generate')
    ;
    var clientId = decodedParams.client_id;

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res);
    };
    return generateAddress.perform(clientId).then(handleResponse);
  };

  Promise.resolve(performer()).catch(function (err) {
    logger.notify('r_adc_1', 'Something went wrong', err);
    responseHelper.error('r_adc_1', 'Something went wrong').renderResponse(res)
  });
});

/* fetch balances for an address */
router.get('/fetch-utility-chain-balances', function (req, res, next) {

  const performer = function() {

    const decodedParams = req.decodedParams
        , balanceTypes = decodedParams.balance_types
        , balancesFetcherKlass = require(rootPrefix + '/app/services/address/utilityChainBalancesFetcher')
        , balancesFetcher = new balancesFetcherKlass(decodedParams)
    ;

    // handle final response
    const handleResponse = function (response) {
      return response.renderResponse(res);
    };

    return balancesFetcher.perform(balanceTypes).then(handleResponse);

  };

  Promise.resolve(performer()).catch(function (err) {
    logger.notify('r_adc_2', 'Something went wrong', err);
    responseHelper.error('r_adc_2', 'Something went wrong').renderResponse(res)
  });

});

module.exports = router;
