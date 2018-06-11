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
 * @routeparam {String} :id - User uuid
 *
 */
router.get('/:id', function (req, res, next) {

  const getBalanceKlass = require(rootPrefix + '/app/services/balances/fetch');
  req.decodedParams.apiName = 'get_balance';
  req.decodedParams.id = req.params.id;

  Promise.resolve(routeHelper.performer(req, res, next, getBalanceKlass, 'r_v1_b_1'));
});

module.exports = router;