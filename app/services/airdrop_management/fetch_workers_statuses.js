"use strict";

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , getReceiptKlass = require(rootPrefix + '/app/services/transaction/get_receipt')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , clientWorkerManagedAddress = require(rootPrefix + '/app/models/client_worker_managed_address_id')
  ;

/**
 * Check whether worker for clients has been properly set up in Airdrop contract.
 * Multiple workers can be set for a client.
 *
 * @constructor
 */
const FetchWorkerStatusesKlass = function(params){
  const oThis = this;

  oThis.workerTrxHash = params.transaction_records;
};

FetchWorkerStatusesKlass.prototype = {

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch((error) => {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_am_fws_3", "Unhandled result", null, {}, {});
        }
      });
  },

  asyncPerform: async function(){
    const oThis = this;

    if(!oThis.workerTrxHash || Object.keys(oThis.workerTrxHash).length == 0){
      return Promise.resolve(responseHelper.error("s_am_fws_1", "Invalid transaction records"));
    }

    var trxMap = {};
    for(var key in oThis.workerTrxHash){
      var rec = oThis.workerTrxHash[key];
      if(rec.status == transactionLogConst.processingStatus){
        trxMap[rec.transaction_hash] = key;
      }
    }

    var promisesArray = [];
    for(var k in trxMap){
      var getRecObj = new getReceiptKlass({transaction_hash: k, chain: 'utility'});
      promisesArray.push(getRecObj.perform());
    }

    if(promisesArray.length > 0){
      var response = await Promise.all(promisesArray);
      var successIds = [];
      for(var i=0;i<response.length;i++){
        var receipt = response[i];
        if(receipt.isSuccess()){
          var trxHash = receipt.data.formattedTransactionReceipt.transactionHash;
          var id = trxMap[trxHash];
          if(oThis.workerTrxHash[id]){
            successIds.push(id);
            oThis.workerTrxHash[id]['status'] = transactionLogConst.completeStatus;
          }
        }
      }
      if(successIds.length > 0){
        new clientWorkerManagedAddress().markStatusActive(successIds);
      }
      return Promise.resolve(responseHelper.successWithData(oThis.workerTrxHash));
    }

    return Promise.resolve(responseHelper.error("s_am_fws_2", "Invalid transaction hashes"));
  }
};

module.exports = FetchWorkerStatusesKlass;