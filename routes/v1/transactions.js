"use strict";

const express = require('express')
;

const rootPrefix = '../..'
  , routeHelper = require(rootPrefix + '/routes/helper')
;

const router = express.Router()
;

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
router.post('/', function (req, res, next) {
  req.decodedParams.apiName = 'execute_transaction';

  const CreateUserKlass = require(rootPrefix + '/app/services/transaction/execute');

  Promise.resolve(routeHelper.performer(req, res, next, CreateUserKlass, 'r_v1_t_1'));
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
router.get('/', function (req, res, next) {
  const GetTransactionListService = require(rootPrefix + '/app/services/transaction/list');
  req.decodedParams.apiName = 'list_transactions';

  Promise.resolve(routeHelper.performer(req, res, next, GetTransactionListService, 'r_v1_t_2'));
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
router.get('/:id', function (req, res, next) {
  const GetTransactionService = require(rootPrefix + '/app/services/transaction/get');
  req.decodedParams.apiName = 'get_transaction';
  req.decodedParams.id = req.params.id;

  Promise.resolve(routeHelper.performer(req, res, next, GetTransactionService, 'r_v1_t_3'));
});

module.exports = router;