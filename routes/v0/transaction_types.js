const express = require('express')
;

const rootPrefix = '../..'
  , routeHelper = require(rootPrefix + '/routes/helper')
;

const router = express.Router()
;

/* Get transaction block info for a transaction hash */
router.get('/list', function (req, res, next) {

  const transactionListKlass = require(rootPrefix + '/app/services/transaction_kind/list');

  Promise.resolve(routeHelper.performer(req, res, next, transactionListKlass, 'r_tk_1'));
});

router.post('/create', function (req, res, next) {

  const newTransactionKlass = require(rootPrefix + '/app/services/transaction_kind/add_new');

  Promise.resolve(routeHelper.performer(req, res, next, newTransactionKlass, 'r_tk_2'));
});

router.post('/edit', function (req, res, next) {

  const editTransactionKlass = require(rootPrefix + '/app/services/transaction_kind/edit');

  Promise.resolve(routeHelper.performer(req, res, next, editTransactionKlass, 'r_tk_3'));
});

router.post('/execute', function (req, res, next) {

  const executeTransactionKlass = require(rootPrefix + '/app/services/transaction/execute_transaction');

  Promise.resolve(routeHelper.performer(req, res, next, executeTransactionKlass, 'r_tk_4'));
});

router.post('/status', function (req, res, next) {

  const getDetailTransactionKlass = require(rootPrefix + '/app/services/transaction/get_detail');

  Promise.resolve(routeHelper.performer(req, res, next, getDetailTransactionKlass, 'r_tk_5'));
});

module.exports = router;
