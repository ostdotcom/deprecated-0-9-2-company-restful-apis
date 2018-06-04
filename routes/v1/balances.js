"use strict";

const express = require('express')
;

const rootPrefix = '../..'
  , routeHelper = require(rootPrefix + '/routes/helper')
;

const router = express.Router()
;


/**
 * Get balance of user
 *
 * @route {GET} {base_url}/get_balance/{id}
 *
 * @routeparam {Decimal} :id - User uuid
 *
 */
router.get('/:id', function (req, res, next) {

  const getBalanceKlass = require(rootPrefix + '/app/services/balance/fetch');
  req.decodedParams.apiName = 'get_balance';

  Promise.resolve(routeHelper.performer(req, res, next, getBalanceKlass, 'r_v1_b_1'));
});

module.exports = router;