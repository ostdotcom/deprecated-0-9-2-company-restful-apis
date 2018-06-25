"use strict";

const express = require('express')
;

const rootPrefix = '../..'
  , routeHelper = require(rootPrefix + '/routes/helper')
  , TransactionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/transaction')
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
  req.decodedParams.id = req.params.id;

  const dataFormatterFunc = async function(response) {

    let transactionLogDDbRecords = response.data['transactionLogDDbRecords']
      , transactionUuids = response.data['transactionUuids']
      , transactionData = []
    ;

    delete response.data['transactionLogDDbRecords'];
    delete response.data['transactionUuids'];

    for (let i=0; i<transactionUuids.length; i++) {

      let transactionUuid = transactionUuids[i];

      let data = transactionLogDDbRecords[transactionUuid];
      if(!data) {continue}

      let transactionEntityFormatter = new TransactionEntityFormatterKlass(data)
        , transactionEntityFormatterRsp = await transactionEntityFormatter.perform()
      ;

      transactionData.push(transactionEntityFormatterRsp.data);

    }

    response.data[response.data.result_type] = transactionData;

  };

  Promise.resolve(routeHelper.performer(req, res, next, getLedgerKlass, 'r_v1.1_l_1', null, dataFormatterFunc));

});

module.exports = router;