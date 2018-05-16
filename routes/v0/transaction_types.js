const express = require('express')
;

const rootPrefix = '../..'
  , routeHelper = require(rootPrefix + '/routes/helper')
  , ActionEntityFormatterClass = require(rootPrefix + '/lib/formatter/entities/v0/action')
  , TransactionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/v0/transaction')
  , UserEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/v0/user')
  , util = require(rootPrefix + '/lib/util')
;

const router = express.Router()
;

/* Get transaction block info for a transaction hash */
router.get('/list', function (req, res, next) {

  req.decodedParams.apiName = 'list_transactions';

  req.decodedParams.extra_entities = ['client_tokens', 'price_points'];

  const transactionListKlass = require(rootPrefix + '/app/services/transaction_kind/list');

  const dataFormatterFunc = async function(response) {

    let transactions = [];

    for (var i=0; i< response.data.actions.length; i++) {
      let actionEntityFormatterRsp = await new ActionEntityFormatterClass(response.data.actions[i]).perform();
      transactions.push(actionEntityFormatterRsp.data);
    }

    delete response.data.actions;

    response.data.result_type = 'transaction_types';
    response.data.transaction_types = transactions;

  };

  Promise.resolve(routeHelper.performer(req, res, next, transactionListKlass, 'r_tk_1', null, dataFormatterFunc));
});

router.post('/create', function (req, res, next) {

  req.decodedParams.apiName = 'create_new_action';

  const newTransactionKlass = require(rootPrefix + '/app/services/transaction_kind/add_new');


  const afterValidationFunc = async function(serviceParamsPerThisVersion) {

    const serviceParamsPerLatestVersion = util.clone(serviceParamsPerThisVersion);

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'currency_type', 'currency');

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'currency_value', 'amount');

    serviceParamsPerLatestVersion.arbitrary_amount = 'false';

    return serviceParamsPerLatestVersion;

  };

  const dataFormatterFunc = async function(response) {

    const actionEntityFormatterRsp = await new ActionEntityFormatterClass(response.data.action).perform();

    delete response.data.action;

    response.data.result_type = 'transactions';
    response.data.transactions = [actionEntityFormatterRsp.data]

  };

  Promise.resolve(routeHelper.performer(req, res, next, newTransactionKlass, 'r_tk_2', afterValidationFunc, dataFormatterFunc));
});

router.post('/edit', function (req, res, next) {

  req.decodedParams.apiName = 'update_action';

  const editTransactionKlass = require(rootPrefix + '/app/services/transaction_kind/edit');

  const afterValidationFunc = async function(serviceParamsPerThisVersion) {

    const serviceParamsPerLatestVersion = util.clone(serviceParamsPerThisVersion);

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'currency_type', 'currency');

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'currency_value', 'amount');

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'client_transaction_id', 'id');

    serviceParamsPerLatestVersion.arbitrary_amount = 'false';

    return serviceParamsPerLatestVersion;

  };

  const dataFormatterFunc = async function(response) {

    const actionEntityFormatterRsp = await new ActionEntityFormatterClass(response.data.action).perform();

    delete response.data.action;

    response.data.result_type = 'transactions';
    response.data.transactions = [actionEntityFormatterRsp.data]

  };


  Promise.resolve(routeHelper.performer(req, res, next, editTransactionKlass, 'r_tk_3', afterValidationFunc, dataFormatterFunc));
});

router.post('/execute', function (req, res, next) {
  req.decodedParams.apiName = 'execute_transaction';

  const executeTransactionKlass = require(rootPrefix + '/app/services/transaction/execute');

  const afterValidationFunc = async function(serviceParamsPerThisVersion) {
    const serviceParamsPerLatestVersion = util.clone(serviceParamsPerThisVersion);

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'from_uuid', 'from_user_id');
    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'to_uuid', 'to_user_id');

    return serviceParamsPerLatestVersion;
  };

  const dataFormatterFunc = async function(response) {

    const actionEntityFormatterRsp = await new TransactionEntityFormatterKlass(response.data.transaction).perform();

    response.data = actionEntityFormatterRsp.data

  };

  Promise.resolve(routeHelper.performer(req, res, next, executeTransactionKlass, 'r_tk_4', afterValidationFunc,
    dataFormatterFunc));
});

router.post('/status', function (req, res, next) {

  req.decodedParams.apiName = 'get_transaction_detail';

  const getDetailTransactionKlass = require(rootPrefix + '/app/services/transaction/get_detail');

  const dataFormatterFunc = async function(response) {

    const transactionTypes = serviceResponse.data.transaction_types
        , formattedTransactionTypes = []
        , users = serviceResponse.data.users
        , formattedUsers = []
        , transactions = serviceResponse.data.transactions
        , formattedTransactions = []
    ;

    delete serviceResponse.data.transaction_types;
    delete serviceResponse.data.users;
    delete serviceResponse.data.transactions;

    for(var i=0; i<transactions.length; i++) {

      const transactionEntityFormatterRsp = await new TransactionEntityFormatterKlass(transactions[i]).perform();
      formattedTransactions.push(transactionEntityFormatterRsp.data);

    }

    for(var i=0; i<transactionTypes.length; i++) {

      const actionEntityFormatterRsp = await new ActionEntityFormatterClass(transactionTypes[i]).perform();
      formattedTransactionTypes.push(actionEntityFormatterRsp.data);

    }

    for(var i=0; i<users.length; i++) {

      const userEntityFormatterRsp = await new UserEntityFormatterKlass(users[i]).perform();
      formattedUsers.push(userEntityFormatterRsp.data);

    }

    response.result_type = 'transactions';
    response.economy_users = actionEntityFormatterRsp.formattedUsers;
    response.transactions = actionEntityFormatterRsp.formattedTransactions;
    response.transaction_types = actionEntityFormatterRsp.formattedTransactionTypes;

  };

  Promise.resolve(routeHelper.performer(
      req, res, next,
      getDetailTransactionKlass, 'r_tk_5',
      null, dataFormatterFunc
  ));

});

module.exports = router;
