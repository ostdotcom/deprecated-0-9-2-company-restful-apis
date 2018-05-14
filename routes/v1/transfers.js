"use strict";

const express = require('express')
;

const rootPrefix = '../..'
  , routeHelper = require(rootPrefix + '/routes/helper')
;

const router = express.Router()
;

/**
 * @name Execute a STP Transfer
 *
 * @route {POST} {base_url}/transfers/
 *
 * @routeparam {string} :to_user_id (mandatory) - uuid of the to user
 * @routeparam {string<float>} :amount (mandatory) - amount to be used in the transfer
 */
router.post('/', function (req, res, next) {
  req.decodedParams.apiName = 'execute_stp_transfer';

  const ExecuteSTPTransferService = require(rootPrefix + '/app/services/stp_transfer/execute');

  Promise.resolve(routeHelper.performer(req, res, next, ExecuteSTPTransferService, 'r_v1_stp_t_1'));
});

/**
 * List transactions from a client
 *
 * @name List STP Transfers
 *
 * @route {GET} {base_url}/transfers
 *
 * @routeparam {number} :page_no (optional) - page number (starts from 1)
 * @routeparam {string} :order_by (optional) - order the list by 'created' (default)
 * @routeparam {string} :order (optional) - order list in 'desc' (default) or 'asc' order.
 * @routeparam {number} :limit (optional) - Min 1, Max 100, Default 10.
 * @routeparam {string} :id (optional) - this is the comma separated ids to filter on.
 */
router.get('/', function (req, res, next) {
  const GetSTPTransferListService = require(rootPrefix + '/app/services/stp_transfer/list');
  req.decodedParams.apiName = 'list_stp_transfers';

  Promise.resolve(routeHelper.performer(req, res, next, GetSTPTransferListService, 'r_v1_stp_t_2'));
});

/**
 * Get STP transfer by id
 *
 * @name Get Transfer
 *
 * @route {GET} {base_url}/transfers/:id
 *
 * @routeparam {number} :id (mandatory) - id of the transaction
 */
router.get('/:id', function (req, res, next) {
  const GetSTPTransferService = require(rootPrefix + '/app/services/stp_transfer/get');

  req.decodedParams.apiName = 'get_stp_transfer';
  req.decodedParams.id = req.params.id;

  Promise.resolve(routeHelper.performer(req, res, next, GetSTPTransferService, 'r_v1_stp_t_3'));
});

module.exports = router;