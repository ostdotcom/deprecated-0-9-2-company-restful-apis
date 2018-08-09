'use strict';

const express = require('express');

const rootPrefix = '../..',
  routeHelper = require(rootPrefix + '/routes/helper'),
  BalanceFormatter = require(rootPrefix + '/lib/formatter/entities/latest/balance');

const router = express.Router();

require(rootPrefix + '/app/services/balances/fetch');

/**
 * Get balance of user
 *
 * @route {GET} {base_url}/get_balance/{id}
 *
 * @routeparam {String} :id - User uuid
 *
 */
router.get('/:id', function(req, res, next) {
  req.decodedParams.apiName = 'get_balance';
  req.decodedParams.id = req.params.id;

  const dataFormatterFunc = async function(response) {
    let balanceFormatter = new BalanceFormatter(response.data);
    let balanceFormatterResponse = await balanceFormatter.perform();

    delete response.data;

    response.data = {};
    response.data.result_type = 'balance';
    response.data.balance = balanceFormatterResponse.data;
  };

  Promise.resolve(routeHelper.performer(req, res, next, 'getFetch', 'r_v1_b_1', null, dataFormatterFunc));
});

module.exports = router;
