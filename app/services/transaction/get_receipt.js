"use strict";

var openStPlatform = require('@openstfoundation/openst-platform')
  , responseHelper = require('../../../lib/formatter/response')
  ;


/**
 * Fetch Transaction Receipt from Transaction Hash
 *
 * @module services/transaction/get_receipt
 */
const GetReceiptKlass = function(params){
  const oThis = this;

  oThis.transactionHash = params.transaction_hash;
  oThis.chain = params.chain;

};

/**
 * Fetch Transaction Receipt for the given transaction Hash
 *
 * @param {object} params - this is object with keys.
 *                  transaction_hash - Transaction Hash to fetch data for.
 *                  chain - Chain name to look at (eg: utility or value)
 *
 * @constructor
 */
GetReceiptKlass.prototype = {

  perform: async function(){
    const oThis = this;

    var obj = new openStPlatform.services.transaction.getTransactionReceipt(
      {'transaction_hash': oThis.transactionHash, 'chain': oThis.chain}
    );

    var response = await obj.perform();
    if(response.isSuccess()){
      return responseHelper.successWithData(response.data)
    } else {
      return responseHelper.error(response.err.code, response.err.message)
    }
  }

};

module.exports = GetReceiptKlass;