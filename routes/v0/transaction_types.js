const express = require('express');

const rootPrefix = '../..',
  routeHelper = require(rootPrefix + '/routes/helper'),
  ActionEntityFormatterClass = require(rootPrefix + '/lib/formatter/entities/v0/action'),
  TransactionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/v0/transaction'),
  UserEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/v0/user'),
  util = require(rootPrefix + '/lib/util');

const router = express.Router();

require(rootPrefix + '/app/services/transaction_kind/list');
require(rootPrefix + '/app/services/transaction_kind/add_new');
require(rootPrefix + '/app/services/transaction_kind/edit');
require(rootPrefix + '/app/services/transaction/execute');
require(rootPrefix + '/app/services/transaction/get_detail');

/* Get transaction block info for a transaction hash */
router.get('/list', function(req, res, next) {
  req.decodedParams.apiName = 'list_actions';

  req.decodedParams.extra_entities = ['client_tokens', 'price_points'];

  const afterValidationFunc = async function(serviceParamsPerThisVersion) {
    const serviceParamsPerLatestVersion = util.clone(serviceParamsPerThisVersion);

    serviceParamsPerLatestVersion.limit = 50;

    return serviceParamsPerLatestVersion;
  };

  const dataFormatterFunc = async function(response) {
    let transactions = [];

    for (var i = 0; i < response.data.actions.length; i++) {
      let actionEntityFormatterRsp = await new ActionEntityFormatterClass(response.data.actions[i]).perform();
      transactions.push(actionEntityFormatterRsp.data);
    }

    delete response.data.actions;

    response.data.result_type = 'transaction_types';
    response.data.transaction_types = transactions;
  };

  Promise.resolve(
    routeHelper.performer(req, res, next, 'getListActionsClass', 'r_tk_1', afterValidationFunc, dataFormatterFunc)
  );
});

router.post('/create', function(req, res, next) {
  req.decodedParams.apiName = 'create_new_action';

  const clientTxTypesConst = require(rootPrefix + '/lib/global_constant/client_transaction_types');

  const afterValidationFunc = async function(serviceParamsPerThisVersion) {
    const serviceParamsPerLatestVersion = util.clone(serviceParamsPerThisVersion);

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'currency_type', 'currency');

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'currency_value', 'amount');

    serviceParamsPerLatestVersion.arbitrary_amount = 'false';

    if (
      !serviceParamsPerLatestVersion.commission_percent &&
      serviceParamsPerLatestVersion.kind == clientTxTypesConst.userToUserKind
    ) {
      serviceParamsPerLatestVersion.commission_percent = '0';
      serviceParamsPerLatestVersion.arbitrary_commission = 'false';
    }

    return serviceParamsPerLatestVersion;
  };

  const dataFormatterFunc = async function(response) {
    const actionEntityFormatterRsp = await new ActionEntityFormatterClass(response.data.action).perform();

    delete response.data.action;

    response.data.result_type = 'transactions';
    response.data.transactions = [actionEntityFormatterRsp.data];
  };

  Promise.resolve(
    routeHelper.performer(req, res, next, 'getAddNewActionClass', 'r_tk_2', afterValidationFunc, dataFormatterFunc)
  );
});

router.post('/edit', function(req, res, next) {
  req.decodedParams.apiName = 'update_action';

  const afterValidationFunc = async function(serviceParamsPerThisVersion) {
    const serviceParamsPerLatestVersion = util.clone(serviceParamsPerThisVersion);

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'currency_type', 'currency');

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'currency_value', 'amount');

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'client_transaction_id', 'id');

    if (serviceParamsPerLatestVersion.amount) {
      serviceParamsPerLatestVersion.arbitrary_amount = 'false';
    }

    return serviceParamsPerLatestVersion;
  };

  const dataFormatterFunc = async function(response) {
    const actionEntityFormatterRsp = await new ActionEntityFormatterClass(response.data.action).perform();

    delete response.data.action;

    response.data.result_type = 'transactions';
    response.data.transactions = [actionEntityFormatterRsp.data];
  };

  Promise.resolve(
    routeHelper.performer(req, res, next, 'getEditActionClass', 'r_tk_3', afterValidationFunc, dataFormatterFunc)
  );
});

router.post('/execute', function(req, res, next) {
  req.decodedParams.apiName = 'execute_transaction';

  const afterValidationFunc = async function(serviceParamsPerThisVersion) {
    const serviceParamsPerLatestVersion = util.clone(serviceParamsPerThisVersion);

    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'from_uuid', 'from_user_id');
    routeHelper.replaceKey(serviceParamsPerLatestVersion, 'to_uuid', 'to_user_id');

    return serviceParamsPerLatestVersion;
  };

  const dataFormatterFunc = async function(response) {
    const rawData = response.data,
      formattedData = {
        transaction_uuid: rawData['transaction_uuid'],
        transaction_hash: rawData['transaction_hash'] || null,
        from_uuid: rawData['from_uuid'],
        to_uuid: rawData['to_uuid'],
        action_id: rawData['action_id']
      };

    response.data = formattedData;
  };

  Promise.resolve(
    routeHelper.performer(
      req,
      res,
      next,
      'getExecuteTransactionService',
      'r_tk_4',
      afterValidationFunc,
      dataFormatterFunc
    )
  );
});

router.post('/status', function(req, res, next) {
  req.decodedParams.apiName = 'get_transaction_detail';

  const dataFormatterFunc = async function(serviceResponse) {
    const transactionTypes = serviceResponse.data.transaction_types,
      formattedTransactionTypes = {},
      users = serviceResponse.data.users,
      formattedUsers = {},
      transactions = serviceResponse.data.transactions,
      formattedTransactions = [];

    delete serviceResponse.data.transaction_types;
    delete serviceResponse.data.users;
    delete serviceResponse.data.transactions;

    for (var i = 0; i < transactions.length; i++) {
      const transactionEntityFormatterRsp = await new TransactionEntityFormatterKlass(transactions[i]).perform();
      formattedTransactions.push(transactionEntityFormatterRsp.data);
    }

    for (var transactionTypeId in transactionTypes) {
      const actionEntityFormatterRsp = await new ActionEntityFormatterClass(
          transactionTypes[transactionTypeId]
        ).perform(),
        data = actionEntityFormatterRsp.data;

      formattedTransactionTypes[data.id] = data;
    }

    for (var userId in users) {
      const userEntityFormatterRsp = await new UserEntityFormatterKlass(users[userId]).perform(),
        data = userEntityFormatterRsp.data;

      formattedUsers[data.id] = data;
    }

    serviceResponse.data.result_type = 'transactions';
    serviceResponse.data.economy_users = formattedUsers;
    serviceResponse.data.transactions = formattedTransactions;
    serviceResponse.data.transaction_types = formattedTransactionTypes;
  };

  Promise.resolve(
    routeHelper.performer(req, res, next, 'getGetTransactionDetailKlass', 'r_tk_5', null, dataFormatterFunc)
  );
});

module.exports = router;
