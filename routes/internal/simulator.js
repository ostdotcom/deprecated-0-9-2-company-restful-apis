const express = require('express')
  , router = express.Router()
  , rootPrefix = '../..'
  , routeHelper = require(rootPrefix + '/routes/helper')
  , TransactionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/transaction')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.internal);

/* Get transaction block info for a transaction hash */
router.post('/create-transaction', function (req, res, next) {

  req.decodedParams.apiName = 'simulate_random_transaction';

  if (basicHelper.isMainSubEnvironment()) {

    let response = responseHelper.error({
      internal_error_identifier: 'r_ob_gto_1',
      api_error_identifier: 'random_transaction_prohibited',
      debug_options: {}
    });

    return response.renderResponse(res, errorConfig);
  }

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
