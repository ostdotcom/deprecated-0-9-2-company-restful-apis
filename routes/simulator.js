const express = require('express')
  , router = express.Router()
  , rootPrefix = '..'
  , routeHelper = require(rootPrefix + '/routes/helper')
;

/* Get transaction block info for a transaction hash */
router.post('/create-transaction', function (req, res, next) {

  const simulateTransactionKlass = require(rootPrefix + '/app/services/transaction/simulate_random_transaction');

  Promise.resolve(routeHelper.performer(req, res, next, simulateTransactionKlass, 'r_tr_srt_1'));

});

router.get('/get-transaction-details', function (req, res, next) {

  const getTransactionDetailsKlass = require(rootPrefix + '/app/services/transaction/get_detail');

  Promise.resolve(routeHelper.performer(req, res, next, getTransactionDetailsKlass, 'r_tr_srt_2'));

});

module.exports = router;
