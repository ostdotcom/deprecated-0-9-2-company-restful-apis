"use strict";

const express = require('express')
;

const rootPrefix = '../..'
  , routeHelper = require(rootPrefix + '/routes/helper')
  , StPrimeTransferFormatter = require(rootPrefix + '/lib/formatter/entities/latest/stp_transfer')
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

  const dataFormatterFunc = async function(response) {

    let stPrimeTransferFormatter = new StPrimeTransferFormatter(response.data)
      , stPrimeTransferFormatterResponse = await stPrimeTransferFormatter.perform()
    ;

    delete response.data;

    response.data = {};
    response.data.result_type = 'transfer';
    response.data.transfer = stPrimeTransferFormatterResponse.data;

  };

  Promise.resolve(routeHelper.performer(req, res, next, ExecuteSTPTransferService, 'r_v1_stp_t_1', null, dataFormatterFunc));
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

  const dataFormatterFunc = async function (response) {

    let transactionLogDDbRecords = response.data['transactionLogDDbRecords']
      , transferUuids = response.data['transferUuids']
      , transferData = []
    ;

    delete response.data['transactionLogDDbRecords'];
    delete response.data['transferUuids'];

    for (let i=0; i<transferUuids.length; i++) {

      let transferUuid = transferUuids[i];

      let data = transactionLogDDbRecords[transferUuid];
      if(!data) {continue}

      let stPrimeTransferFormatter = new StPrimeTransferFormatter(data)
        , stPrimeTransferFormatterRsp = await stPrimeTransferFormatter.perform()
      ;

      transferData.push(stPrimeTransferFormatterRsp.data);

    }

    response.data[response.data.result_type] = transferData;

  };

  Promise.resolve(routeHelper.performer(
    req, res, next, GetSTPTransferListService,
    'r_v1_stp_t_2', null, dataFormatterFunc)
  );
  
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
  
  const dataFormatterFunc = async function (response) {

    let stPrimeTransferFormatter = new StPrimeTransferFormatter(response.data)
      , stPrimeTransferFormatterResponse = await stPrimeTransferFormatter.perform()
    ;

    delete response.data;

    response.data = {};
    response.data.result_type ='transfer';
    response.data.transfer = stPrimeTransferFormatterResponse.data;
  };

  Promise.resolve(routeHelper.performer(req, res, next, GetSTPTransferService, 'r_v1_stp_t_4', null, dataFormatterFunc));
});

module.exports = router;