"use strict";

/**
 * Get detail for transactiuons having uuids
 *
 * @param {object} params - this is object with keys.
 *                  transaction_uuids - Transaction UUIDs
 *                  chain - Chain name to look at (eg: utility or value)
 *
 * @module app/services/transaction/get_detail
 */

const rootPrefix = '../../..'
  , GetReceiptKlass = require(rootPrefix + '/app/services/transaction/get_receipt')
  , transactionLogKlass = require(rootPrefix + '/app/models/transaction_log')
;

const GetTransactionDetailKlass = function(params){
  const oThis = this;

  oThis.transactionUuids = params.transaction_uuids;
  oThis.chain = params.chain;

  oThis.transactionUuidToHashMap = {};
  oThis.transactionHashToReceiptMap = {};
};

GetTransactionDetailKlass.prototype = {
  perform: async function() {
    const oThis = this;

    await oThis._getTransactionHashes();

    await oThis._getTransactionReceipts();

    console.log('oThis.transactionUuidToHashMap', oThis.transactionUuidToHashMap);
    console.log('oThis.transactionHashToReceiptMap', oThis.transactionHashToReceiptMap);
  },

  _getTransactionHashes: async function() {
    const oThis = this;

    const transactionLogObj = new transactionLogKlass()
    ;

    const transactionLogRecords = await transactionLogObj.where(
      ['transaction_uuid in ?', oThis.transactionUuids]).select('transaction_hash, transaction_uuid').fire();

    for(var i = 0; i < transactionLogRecords.length; i++) {
      const currRecord = transactionLogRecords[i];
      oThis.transactionUuidToHashMap[currRecord.transaction_uuid] = currRecord.transaction_hash;
    }

    return Promise.resolve();
  },

  _getTransactionReceipts: async function() {
    const oThis = this
      , promiseArray = [];

    for(var uuid in oThis.transactionUuidToHashMap) {
      const transactionHash = oThis.transactionUuidToHashMap[uuid]
        , getReceiptObj = new GetReceiptKlass({transaction_hash: transactionHash, chain: oThis.chain})

      promiseArray.push(getReceiptObj.perform());
    }

    const promiseResults = await Promise.all(promiseArray);

    for(var i = 0; i < promiseResults.length; i++) {
      const transactionReceipt = promiseResults[i];
      oThis.transactionHashToReceiptMap[transactionReceipt.rawTransactionReceipt.transaction_hash] = transactionReceipt;
    }

    return Promise.resolve();
  }
};