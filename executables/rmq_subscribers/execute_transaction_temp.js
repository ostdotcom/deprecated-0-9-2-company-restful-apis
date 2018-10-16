// 'use strict';
//
// /**
//  * This script will execute transactions by subscribing to RMQ events.
//  *
//  * Usage: node executables/rmq_subscribers/execute_transaction_temp.js
//  *
//  * @module executables/rmq_subscribers/execute_transaction_temp
//  */
// const rootPrefix = '../..';
//
// // Load external packages
// const openSTNotification = require('@openstfoundation/openst-notification');
//
// const publishToSlowQueue = async function(parsedParams) {
//   openSTNotification.publishEvent.perform({
//     topics: ['slow.transaction.execute'],
//     publisher: parsedParams.publisher,
//     message: parsedParams.message
//   });
// };
//
// openSTNotification.subscribeEvent.rabbit(
//   ['transaction.execute'],
//   {
//     queue: 'transaction_execute_from_restful_apis',
//     ackRequired: 1,
//     prefetch: 100
//   },
//   function(params) {
//     publishToSlowQueue(JSON.parse(params));
//
//     // Promise is required to be returned to manually ack messages in RMQ
//     return Promise.resolve();
//   }
// );
