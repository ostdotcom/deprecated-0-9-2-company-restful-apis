'use strict';
/**
 * This script will keep a look on transaction meta and take steps accordingly.
 *
 * Steps for Statuses
 *  - Queued
 *    If transaction is in queued status for more than x time then mark as failed.
 *
 *  - Geth Down
 *    If transaction meta says Geth is down then try resubmitting after sometime.
 *
 * Example: node executables/transaction_meta_observer.js
 *
 * @module executables/transaction_meta_observer
 */

const rootPrefix = '../../..';

const program = require('commander');

program.option('--process-id <processId>', 'Process id').option('--prefetch-count <prefetchCount>', 'Prefetch Count');

program.on('--help', () => {
  console.log('');
  console.log('  Example:');
  console.log('');
  console.log(
    '    node ./executables/continuous/lockables/transaction_meta_observer.js --process-id 123 --prefetch-count 10'
  );
  console.log('');
  console.log('');
});

program.parse(process.argv);

// Validate and sanitize the commander parameters.
const validateAndSanitize = function() {
  if (!program.processId) {
    program.help();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

const baseKlass = require(rootPrefix + '/executables/continuous/lockables/base'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  transactionMetaConst = require(rootPrefix + '/lib/global_constant/transaction_meta');

let TransactionStatusHandlers = {};

const setTransactionStatusHandlers = function() {
  let is = transactionMetaConst.invertedStatuses;
  TransactionStatusHandlers[parseInt(is[transactionMetaConst.queued])] = require(rootPrefix +
    '/lib/transaction_error_handlers/queued_handler');
  TransactionStatusHandlers[parseInt(is[transactionMetaConst.submitted])] = require(rootPrefix +
    '/lib/transaction_error_handlers/submitted_handler');
  TransactionStatusHandlers[parseInt(is[transactionMetaConst.geth_down])] = require(rootPrefix +
    '/lib/transaction_error_handlers/geth_down_handler');
};

setTransactionStatusHandlers();

/**
 * @constructor
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const TransactionMetaObserverKlass = function(params) {
  const oThis = this;

  oThis.lockId = new Date().getTime();
  oThis.currentTime = Math.floor(new Date().getTime() / 1000);
  oThis.transactionsToProcess = [];

  baseKlass.call(oThis, params);
};

TransactionMetaObserverKlass.prototype = Object.create(baseKlass.prototype);

const TransactionMetaObserverKlassPrototype = {
  execute: async function() {
    const oThis = this;

    oThis.transactionsToProcess = await new TransactionMetaModel()
      .select('*')
      .where(['lock_id = ?', oThis.getLockId()])
      .fire();

    await oThis._processPendingTransactions();
  },

  getLockId: function() {
    const oThis = this;
    return parseFloat(oThis.lockId + '.' + oThis.processId);
  },

  getModel: function() {
    return TransactionMetaModel;
  },

  lockingConditions: function() {
    const oThis = this;

    // Fetch all Transactions whose Next action time has been crossed
    return [
      'status IN (?) AND next_action_at < ? AND retry_count < 10',
      Object.keys(TransactionStatusHandlers),
      oThis.currentTime
    ];
  },

  getNoOfRowsToProcess: function() {
    const oThis = this;

    return oThis.noOfRowsToProcess || 100;
  },

  updateItems: function() {},

  _processPendingTransactions: async function() {
    const oThis = this;

    let transactionsGroup = {};
    for (let i = 0; i < oThis.transactionsToProcess.length; i++) {
      let txMeta = oThis.transactionsToProcess[i];

      transactionsGroup[txMeta.status] = transactionsGroup[txMeta.status] || [];
      transactionsGroup[txMeta.status].push(txMeta);
    }

    let promisesArray = [];
    for (let txStatus in TransactionStatusHandlers) {
      let handlerKlass = TransactionStatusHandlers[txStatus];
      if (transactionsGroup[txStatus] && transactionsGroup[txStatus].length > 0) {
        promisesArray.push(new handlerKlass(transactionsGroup[txStatus]).perform());
      }
    }
    return await Promise.all(promisesArray);
  }
};

Object.assign(TransactionMetaObserverKlass.prototype, TransactionMetaObserverKlassPrototype);

new TransactionMetaObserverKlass({
  process_id: program.processId,
  no_of_rows_to_process: program.prefetchCount,
  release_lock_required: false
}).perform();

// // Using a single function to handle multiple signals
// function handle() {
//   logger.info('Received Signal');
//
//   if (!PromiseQueueManager.getPendingCount() && !unAckCount) {
//     console.log('SIGINT/SIGTERM handle :: No pending Promises.');
//     process.exit(1);
//   }
//
//   let f = function() {
//     if (unAckCount != PromiseQueueManager.getPendingCount()) {
//       logger.error('ERROR :: unAckCount and pending counts are not in sync.');
//     }
//     if (PromiseQueueManager.getPendingCount() <= 0 || unAckCount <= 0) {
//       console.log('SIGINT/SIGTERM handle :: No pending Promises.');
//       process.exit(1);
//     } else {
//       logger.info('waiting for open tasks to be done.');
//       setTimeout(f, 1000);
//     }
//   };
//
//   setTimeout(f, 1000);
// }
//
// // handling gracefully process exit on getting SIGINT, SIGTERM.
// // Once signal found programme will stop consuming new messages. But need to clear running messages.
// process.on('SIGINT', handle);
// process.on('SIGTERM', handle);
