'use strict';

const express = require('express');

const rootPrefix = '../..',
  routeHelper = require(rootPrefix + '/routes/helper'),
  TransactionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/transaction');

const router = express.Router();

require(rootPrefix + '/app/services/transaction/execute');
require(rootPrefix + '/app/services/transaction/get');
require(rootPrefix + '/app/services/transaction/list/for_client_id');

//TODO: Try to reuse code from v1 transactions router file

/**
 * @name Execute a transaction
 *
 * @route {POST} {base_url}/transactions/
 *
 * @routeparam {string} :from_user_id (mandatory) - uuid of the from user
 * @routeparam {string} :to_user_id (mandatory) - uuid of the to user
 * @routeparam {string} :action_id (mandatory) - id of the action
 * @routeparam {string<float>} :amount (optional) - amount to be used in the transaction - mandatory depending on action setup
 * @routeparam {string} :commission_percent (optional) - commission percent - mandatory depending on action setup
 */
router.post('/', function(req, res, next) {
  req.decodedParams.apiName = 'execute_transaction';

  const dataFormatterFunc = async function(response) {
    const transactionEntityFormatter = new TransactionEntityFormatterKlass(response.data),
      transactionEntityFormatterRsp = await transactionEntityFormatter.perform();

    delete response.data;

    response.data = {
      result_type: 'transaction',
      transaction: transactionEntityFormatterRsp.data
    };
  };

  Promise.resolve(
    routeHelper.performer(req, res, next, 'getExecuteTransactionService', 'r_v1.1_t_1', null, dataFormatterFunc)
  );
});

/**
 * List transactions from a client
 *
 * @name List Transactions
 *
 * @route {GET} {base_url}/transactions
 *
 * @routeparam {number} :page_no (optional) - page number (starts from 1)
 * @routeparam {string} :order_by (optional) - order the list by 'created' (default)
 * @routeparam {string} :order (optional) - order list in 'desc' (default) or 'asc' order.
 * @routeparam {number} :limit (optional) - Min 1, Max 100, Default 10.
 */
router.get('/', function(req, res, next) {
  req.decodedParams.apiName = 'list_transactions';

  const dataFormatterFunc = async function(response) {
    let transactionLogDDbRecords = response.data['transactionLogDDbRecords'],
      transactionUuids = response.data['transactionUuids'],
      transactionData = [];

    delete response.data['transactionLogDDbRecords'];
    delete response.data['transactionUuids'];

    for (let i = 0; i < transactionUuids.length; i++) {
      let transactionUuid = transactionUuids[i];
      let data = transactionLogDDbRecords[transactionUuid];
      if (!data) {
        continue;
      }

      let transactionEntityFormatter = new TransactionEntityFormatterKlass(data),
        transactionEntityFormatterRsp = await transactionEntityFormatter.perform();

      transactionData.push(transactionEntityFormatterRsp.data);
    }

    response.data[response.data.result_type] = transactionData;
  };

  Promise.resolve(
    routeHelper.performer(req, res, next, 'getGetTransactionListByClientIdClass', 'r_v1.1_t_2', null, dataFormatterFunc)
  );
});

/**
 * Get transaction by id
 *
 * @name Get Transaction
 *
 * @route {GET} {base_url}/transactions/:id
 *
 * @routeparam {number} :id (mandatory) - id of the transaction
 */
router.get('/:id', function(req, res, next) {
  req.decodedParams.apiName = 'get_transaction';
  req.decodedParams.id = req.params.id;

  const dataFormatterFunc = async function(response) {
    let transactionEntityFormatter = new TransactionEntityFormatterKlass(response.data),
      transactionEntityFormatterRsp = await transactionEntityFormatter.perform();

    delete response.data;

    response.data = {};
    response.data.result_type = 'transaction';
    response.data.transaction = transactionEntityFormatterRsp.data;
  };

  Promise.resolve(
    routeHelper.performer(req, res, next, 'getGetTransactionsService', 'r_v1.1_t_3', null, dataFormatterFunc)
  );
});

module.exports = router;
