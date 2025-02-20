// NOTE: This file has been commented out as it used TransactionLogMysqlModel which isn't
// being used right now. This file is currently un-functional as the functions it uses don't
// exist anymore.
//
//
// "use strict";
//
// const rootPrefix = ".."
//     , transactionLogModel = require(rootPrefix + '/app/models/transaction_log')
//     , basicHelper = require(rootPrefix + '/helpers/basic')
// ;
//
// const PopulateNewColumnsKlass = function(params){
//   const oThis = this;
//   oThis.startId = params.startId;
//   oThis.endId = params.endId;
// };
//
// PopulateNewColumnsKlass.prototype = {
//
//   perform: async function () {
//
//     const oThis = this
//         , pageLimit = 100
//         , transaction_type = '1';
//
//     var startId = oThis.startId
//         , transactionLog = undefined
//         , inputParams = undefined
//         , formattedReceipt = undefined
//         , promise = undefined;
//
//     while(startId <= oThis.endId) {
//
//       var transactionLogs = await new transactionLogModel().select().where(['id >= ? AND id <= ?', startId, oThis.endId]).limit(pageLimit).fire();
//       var promisesArray = [];
//
//       for(var i = 0; i<transactionLogs.length; i++) {
//
//         transactionLog = transactionLogs[i];
//
//         if (transactionLog.transaction_uuid != transactionLog.process_uuid) {
//           continue;
//         }
//
//         inputParams = JSON.parse(transactionLog.input_params);
//
//         formattedReceipt = JSON.parse(transactionLog.formatted_receipt);
//
//         if (!inputParams.gas_price) {
//           console.error('problem_with_row: ', transactionLog.id);
//           continue;
//         }
//
//         promise = new transactionLogModel().update({
//           transaction_type: transaction_type,
//           gas_used: formattedReceipt.gas_used,
//           gas_price: basicHelper.convertToBigNumber(inputParams.gas_price).toString(10),
//           block_number: formattedReceipt.block_number
//         }).where({id: transactionLog.id}).fire();
//
//         promisesArray.push(promise);
//
//       }
//
//       await Promise.all(promisesArray);
//
//       startId = startId + pageLimit;
//
//     }
//
//   }
//
// };
//
// const populateData = new PopulateNewColumnsKlass({startId: 513, endId: 600});
// populateData.perform().then(console.log);
