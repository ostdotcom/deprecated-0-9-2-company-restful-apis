const express = require('express'),
  router = express.Router();

const rootPrefix = '../..',
  routeHelper = require(rootPrefix + '/routes/helper');

require(rootPrefix + '/app/services/stake_and_mint/get_staked_amount');
require(rootPrefix + '/app/services/stake_and_mint/start');

router.get('/get-staked-amount', function(req, res, next) {
  req.decodedParams.apiName = 'fetch_staked_ost_amount';

  Promise.resolve(routeHelper.performer(req, res, next, 'getGetStakedAmountKlass', 'r_su_2'));
});

router.post('/start', function(req, res, next) {
  req.decodedParams.apiName = 'start_stake_and_mint';

  Promise.resolve(routeHelper.performer(req, res, next, 'getStartStakeAndMintKlass', 'r_su_3'));
});

module.exports = router;
