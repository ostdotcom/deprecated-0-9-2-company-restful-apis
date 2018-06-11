"use strict";

const express = require('express')
;

const rootPrefix = '../..'
  , routeHelper = require(rootPrefix + '/routes/helper')
;

const router = express.Router()
;

/**
 * Get ledger of transactions of user
 *
 * @route {GET} {base_url}/{id}
 *
 * @routeparam {String} :id - User uuid
 *
 */
router.get('/:id', function (req, res, next) {

  const getLedgerKlass = require(rootPrefix + '/app/services/transaction/list/for_user_id');
  req.decodedParams.apiName = 'get_transaction_ledger';

  Promise.resolve(routeHelper.performer(req, res, next, getLedgerKlass, 'r_v1_l_1'));

});

module.exports = router;