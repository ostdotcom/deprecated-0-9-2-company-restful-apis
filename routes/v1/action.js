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


router.post('/', function (req, res, next) {

  req.decodedParams.apiName = 'create_new_action';

  const newTransactionKlass = require(rootPrefix + '/app/services/transaction_kind/add_new');

  Promise.resolve(routeHelper.performer(req, res, next, newTransactionKlass, 'r_v1_a_1'));
});