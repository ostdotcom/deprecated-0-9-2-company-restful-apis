const express = require('express')
  , router = express.Router()
;

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , openStPlatform = require('@openstfoundation/openst-platform')
  , routeHelper = require(rootPrefix + '/routes/helper')
;

router.get('/get-receipt', function (req, res, next) {

  const getReceiptKlass = require(rootPrefix + '/app/services/transaction/get_receipt');

  Promise.resolve(routeHelper.performer(req, res, next, getReceiptKlass, 'r_su_1'));

});

router.get('/get-staked-amount', function (req, res, next) {

  const GetStakedAmountKlass = require(rootPrefix + '/app/services/stake_and_mint/get_staked_amount');

  Promise.resolve(routeHelper.performer(req, res, next, GetStakedAmountKlass, 'r_su_2'));

});

router.post('/start', function (req, res, next) {

  const StartStakeAndMintKlass = require(rootPrefix + '/app/services/stake_and_mint/start');

  Promise.resolve(routeHelper.performer(req, res, next, StartStakeAndMintKlass, 'r_su_3'));

});

module.exports = router;
