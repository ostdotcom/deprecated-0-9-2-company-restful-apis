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

module.exports = router;