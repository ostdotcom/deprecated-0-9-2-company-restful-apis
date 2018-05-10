"use strict";

const express = require('express')
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , routeHelper = require(rootPrefix + '/routes/helper')
;

const router = express.Router()
;

/* Create a new action */
router.post('/', function (req, res, next) {

  req.decodedParams.apiName = 'create_new_action';

  const newTransactionKlass = require(rootPrefix + '/app/services/transaction_kind/add_new');

  const dataFormatterFunc = async function(response) {

    delete response.data.extra_entities;
  };

  Promise.resolve(routeHelper.performer(req, res, next, newTransactionKlass, 'r_v1_a_1', null , dataFormatterFunc));
});

/* Update action */
router.post('/:id', function (req, res, next) {

  req.decodedParams.apiName = 'update_action';

  req.decodedParams.id = req.params.id;

  const editTransactionKlass = require(rootPrefix + '/app/services/transaction_kind/edit');

  Promise.resolve(routeHelper.performer(req, res, next, editTransactionKlass, 'r_v1_a_2'));
});

/* Get list of actions */
router.get('/', function (req, res, next) {

  req.decodedParams.apiName = 'list_actions';

  const transactionListKlass = require(rootPrefix + '/app/services/transaction_kind/list');

  Promise.resolve(routeHelper.performer(req, res, next, transactionListKlass, 'r_v1_a_3'));
});

/* Get an action by id */
router.get('/:id', function (req, res, next) {

  req.decodedParams.apiName = 'get_action';

  req.decodedParams.id = req.params.id;

  const transactionGetKlass = require(rootPrefix + '/app/services/transaction_kind/get');

  Promise.resolve(routeHelper.performer(req, res, next, transactionGetKlass, 'r_v1_a_4'));
});

module.exports = router;