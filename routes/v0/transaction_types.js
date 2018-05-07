const express = require('express')
;

const rootPrefix = '../..'
  , routeHelper = require(rootPrefix + '/routes/helper')
  , ActionEntityFormatterClass = require(rootPrefix + '/lib/formatter/entities/v0/action')
;

const router = express.Router()
;

/* Get transaction block info for a transaction hash */
router.get('/list', function (req, res, next) {

  const transactionListKlass = require(rootPrefix + '/app/services/transaction_kind/list');

  Promise.resolve(routeHelper.performer(req, res, next, transactionListKlass, 'r_tk_1'));
});

router.post('/create', function (req, res, next) {

  req.decodedParams.apiName = 'create_new_action';

  const newTransactionKlass = require(rootPrefix + '/app/services/transaction_kind/add_new');


  const afterValidationFunc = async function(serviceParamsPerThisVersion) {

    const serviceParamsPerLatestVersion = util.clone(serviceParamsPerThisVersion);

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'currency_type', 'currency');

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'currency_value', 'amount');

    return serviceParamsPerLatestVersion;

  };

  const dataFormatterFunc = async function(response) {

    const actionEntityFormatterRsp = await new ActionEntityFormatterClass(response.data.action).perform();

    delete response.data.user;

    response.data.result_type = 'transactions';
    response.data.transactions = [actionEntityFormatterRsp.data]

  };

  Promise.resolve(routeHelper.performer(req, res, next, newTransactionKlass, 'r_tk_2', null, dataFormatterFunc));
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
