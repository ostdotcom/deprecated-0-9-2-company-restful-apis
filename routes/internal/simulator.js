const express = require('express')
  , router = express.Router()
  , rootPrefix = '../..'
  , routeHelper = require(rootPrefix + '/routes/helper')
  , TransactionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/transaction')

/* Get transaction block info for a transaction hash */
router.post('/create-transaction', function (req, res, next) {

  req.decodedParams.apiName = 'simulate_random_transaction';

  const simulateTransactionKlass = require(rootPrefix + '/app/services/transaction/simulate_random_transaction');

  Promise.resolve(routeHelper.performer(req, res, next, simulateTransactionKlass, 'r_tr_srt_1'));

});

router.get('/get-transaction-details', function (req, res, next) {

  req.decodedParams.apiName = 'fetch_transaction_details';

  const getTransactionDetailsKlass = require(rootPrefix + '/app/services/transaction/get_detail');

  const dataFormatterFunc = async function(response) {

    let transactions = [];

    for (var i=0; i< response.data.transactions.length; i++) {
      let transactionEntityFormatterRsp = await new TransactionEntityFormatterKlass(response.data.transactions[i]).perform();
      transactions.push(transactionEntityFormatterRsp.data);
    }

    delete response.data.transactions;

    response.data.result_type = 'transactions';
    response.data.transactions = transactions;

  };

  Promise.resolve(routeHelper.performer(req, res, next, getTransactionDetailsKlass, 'r_tr_srt_2', null, dataFormatterFunc));

});

module.exports = router;
