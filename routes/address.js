const express = require('express')
  , router = express.Router()
  , rootPrefix = '..'
  , routeHelper = require(rootPrefix + '/routes/helper')
;

/* fetch balances for an address */
router.get('/fetch-utility-chain-balances', function (req, res, next) {

  const balancesFetcherKlass = require(rootPrefix + '/app/services/address/utilityChainBalancesFetcher');

  Promise.resolve(routeHelper.performer(req, res, next, balancesFetcherKlass, 'r_adc_2'));

});

module.exports = router;
