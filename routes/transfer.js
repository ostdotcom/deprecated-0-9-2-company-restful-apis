const express = require('express')
  , router = express.Router()
  , rootPrefix = '..'
  , routeHelper = require(rootPrefix + '/routes/helper')
;

router.post('/bt-by-tx-kind', function (req, res, next) {

  const executeTransactionKlass = require(rootPrefix + '/app/services/transaction/execute_transaction');

  Promise.resolve(routeHelper.performer(req, res, next, executeTransactionKlass, 'r_tk_4'));

});

module.exports = router;
