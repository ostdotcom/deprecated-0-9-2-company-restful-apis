"use strict";

const openStPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
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
  oThis.addressToNameMap = params.address_to_name_map || {};

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

    const obj = new openStPlatform.services.transaction.getReceipt(
      {
        transaction_hash: oThis.transactionHash,
        chain: oThis.chain,
        address_to_name_map: oThis.addressToNameMap
      }
    );

    const response = await obj.perform();
    if(response.isSuccess()){
      return Promise.resolve(responseHelper.successWithData(response.data));
    } else {
      return Promise.resolve(responseHelper.error(response.err.code, response.err.message));
    }
  }

};

module.exports = GetReceiptKlass;