"use strict";

const rootPrefix = ".."
    , transactionLogModel = require(rootPrefix + '/app/models/transaction_log');

const UpdateExistingColumnsKlass = function(params){
  const oThis = this;
  oThis.startId = params.startId;
  oThis.endId = params.endId;
};

UpdateExistingColumnsKlass.prototype = {

  perform: async function () {

    const oThis = this
        , pageLimit = 1000;

    var startId = oThis.startId
        , transactionLog = undefined
        , inputParams = undefined
        , formattedReceipt = undefined
    ;

    while(startId <= oThis.endId) {

      var transactionLogs = await new transactionLogModel().select().where(['id >= ? AND id <= ?', startId, oThis.endId]).limit(pageLimit).fire();

      for(var i=0; i<transactionLogs.length; i++) {

        transactionLog = transactionLogs[i];

        if (transactionLog.transaction_uuid != transactionLog.process_uuid) {
          continue;
        }

        inputParams = JSON.parse(transactionLog.input_params);

        formattedReceipt = JSON.parse(transactionLog.formatted_receipt);

        new transactionLogModel().updateRecord(
            transactionLog.id,
            {
              input_params: inputParams,
              formatted_receipt: formattedReceipt
            }
        )

      }

      startId = startId + pageLimit;

    }

  }

};

const updateData = new UpdateExistingColumnsKlass({startId: 513, endId: 600});
updateData.perform().then(console.log);