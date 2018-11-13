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
 *  - Submitted
 *    If transaction meta says status submitted for sometime then check on geth, and resubmit if not found on geth.
 *
 * Example: node executables/continuous/lockables/transaction_meta_observer.js --process-id 123 --prefetch-count 10
 *
 * @module executables/transaction_meta_observer
 */

const rootPrefix = '../../..';

// Always include module overrides first.
require(rootPrefix + '/module_overrides/index');

// Require modules.
const SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger.js'),
  CronProcessesHandler = require(rootPrefix + '/lib/cron_processes_handler'),
  baseKlass = require(rootPrefix + '/executables/continuous/lockables/base'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes'),
  transactionMetaConst = require(rootPrefix + '/lib/global_constant/transaction_meta'),
  CronProcessHandlerObject = new CronProcessesHandler();

const usageDemo = function() {
  logger.log('usage:', 'node ./executables/continuous/lockables/transaction_meta_observer.js processLockId');
  logger.log(
    '* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.'
  );
};

const args = process.argv,
  processLockId = args[2];

// Declare variables.
let runCount = 1,
  prefetchCount,
  cronKind = CronProcessesConstants.transactionMetaObserver,
  TransactionStatusHandlers = {};

// Validate and sanitize the commander parameters.
const validateAndSanitize = function() {
  if (!processLockId) {
    usageDemo();
    process.emit('SIGINT');
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

const setTransactionStatusHandlers = function() {
  let invertedStatuses = transactionMetaConst.invertedStatuses;
  TransactionStatusHandlers[parseInt(invertedStatuses[transactionMetaConst.queued])] = require(rootPrefix +
    '/lib/transaction_error_handlers/queued_handler');
  TransactionStatusHandlers[parseInt(invertedStatuses[transactionMetaConst.submitted])] = require(rootPrefix +
    '/lib/transaction_error_handlers/submitted_handler');
  TransactionStatusHandlers[parseInt(invertedStatuses[transactionMetaConst.geth_down])] = require(rootPrefix +
    '/lib/transaction_error_handlers/geth_down_handler');
  TransactionStatusHandlers[parseInt(invertedStatuses[transactionMetaConst.geth_out_of_sync])] = require(rootPrefix +
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

  oThis.setCurrentTime();
  oThis.transactionsToProcess = [];
  oThis.handlerPromises = [];

  baseKlass.call(oThis, params);
  SigIntHandler.call(oThis, { id: processLockId });
};

TransactionMetaObserverKlass.prototype = Object.create(baseKlass.prototype);
Object.assign(TransactionMetaObserverKlass.prototype, SigIntHandler.prototype);

const TransactionMetaObserverKlassPrototype = {
  setCurrentTime: function() {
    const oThis = this;
    oThis.lockId = new Date().getTime();
    oThis.currentTime = Math.floor(new Date().getTime() / 1000);
  },

  execute: async function() {
    const oThis = this;

    oThis.transactionsToProcess = [];

    oThis.transactionsToProcess = await new TransactionMetaModel()
      .select('*')
      .where(['lock_id = ?', oThis.getLockId()])
      .fire();

    return oThis._processPendingTransactions();
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

    for (let txStatus in TransactionStatusHandlers) {
      let handlerKlass = TransactionStatusHandlers[txStatus];
      if (transactionsGroup[txStatus] && transactionsGroup[txStatus].length > 0) {
        oThis.handlerPromises.push(new handlerKlass(transactionsGroup[txStatus]).perform());
      }
    }
    await Promise.all(oThis.handlerPromises);
    oThis.handlerPromises = [];
    return Promise.resolve(oThis.handlerPromises);
  },

  pendingTasksDone: function() {
    const oThis = this;
    return oThis.handlerPromises.length === 0 && !oThis.lockAcquired;
  }
};

Object.assign(TransactionMetaObserverKlass.prototype, TransactionMetaObserverKlassPrototype);

let txMetaObserver = new TransactionMetaObserverKlass({
  process_id: processLockId,
  no_of_rows_to_process: prefetchCount,
  release_lock_required: false
});

const runTask = async function() {
  txMetaObserver.setCurrentTime();

  function onExecutionComplete() {
    // If too much load that iteration has processed full prefetch transactions, then don't wait for much time.
    let nextIterationTime = txMetaObserver.transactionsToProcess.length === prefetchCount ? 10 : 120000;

    if (runCount >= 10) {
      // Executed 10 times now exiting
      logger.log(runCount + ' iteration is executed, Killing self now. ');
      process.emit('SIGINT');
    } else {
      logger.log(runCount + ' iteration is executed, Sleeping now for seconds ' + nextIterationTime / 1000);
      runCount = runCount + 1;
      setTimeout(runTask, nextIterationTime);
    }
  }
  txMetaObserver
    .perform()
    .then(function() {
      onExecutionComplete();
    })
    .catch(function() {
      onExecutionComplete();
    });
};

// Check whether the cron can be started or not.
CronProcessHandlerObject.canStartProcess({
  id: +processLockId, // Implicit string to int conversion.
  cron_kind: cronKind
}).then(async function(dbResponse) {
  let cronParams;

  try {
    cronParams = JSON.parse(dbResponse.data.params);
  } catch (err) {
    logger.error('cronParams stored in INVALID format in the DB.');
    process.emit('SIGINT');
  }

  prefetchCount = +cronParams.prefetchCount; // Implicit string to int conversion.
  if (!prefetchCount) {
    logger.error('prefetchCount NOT available in cron params in the database.');
    process.emit('SIGINT');
  }

  await runTask();
});

CronProcessHandlerObject.endAfterTime({ time_in_minutes: 40 });
