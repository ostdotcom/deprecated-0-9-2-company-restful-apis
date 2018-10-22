'use strict';
/**
 * This script will check that whether the transactions in transaction_meta table were actually submitted
 * to geth. If the transactions were not submitted, it would call transaction_meta_observer cron.
 * If the transactions were indeed submitted to geth, but the status was not updated in the DB due to some reason,
 * it would send a notification email notifying of this issue and update the status in the DB.
 *
 * This script runs every 5 minutes.
 *
 * Usage: node executables/continuous/lockables/reconfirm_transaction.js processId group_id
 *
 * Command Line Parameters Description:
 * processId: process id to start the process
 * group_id: group id for fetching config strategy
 *
 * Example: node executables/continuous/lockables/reconfirm_transaction.js 12345 1000
 *
 * @module executables/continuous/lockables/reconfirm_transaction
 */

const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  baseKlass = require(rootPrefix + '/executables/continuous/lockables/base'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  transactionMetaConst = require(rootPrefix + '/lib/global_constant/transaction_meta'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id');

require(rootPrefix + '/lib/web3/interact/ws_interact');

/**
 * @constructor
 *
 * @param {Object} params
 * @param {Number} params.group_id
 * @param {Number} params.interval_in_minutes
 * @param {Number} params.submitted_stuck_interval
 *
 */
const ReconfirmTransactionsKlass = function(params) {
  const oThis = this;

  oThis.groupId = params.group_id;
  oThis.intervalInMinutes = params.interval_in_minutes;
  oThis.submittedStuckInterval = params.submitted_stuck_interval; // in minutes.

  oThis.whereClause = [];
  oThis.web3Interact = {};
  oThis.configStrategy = {};
  oThis.submittedTransactions = [];
  oThis.transactionsToBeResubmitted = [];
  oThis.transactionsToBeNotifiedAbout = [];
  oThis.transactionsWithSubmittedStuck = [];
  oThis.lockId = Math.floor(new Date().getTime() / 1000);
  oThis.submittedStatus = transactionMetaConst.invertedStatuses[transactionMetaConst.submitted];

  baseKlass.call(oThis, params);
};

ReconfirmTransactionsKlass.prototype = Object.create(baseKlass.prototype);

const ReconfirmTransactionsKlassPrototype = {
  /**
   * Execute
   *
   * @return {Promise<void>}
   */
  execute: async function() {
    const oThis = this;

    await oThis._getWeb3InteractObject();

    await oThis._getSubmittedTransactionsFromTxMeta();

    await oThis._getTransactionsFromGeth();

    if (oThis.transactionsToBeResubmitted.length > 0) {
      await oThis._setNextRetryTimeStamp();
    }
    if (oThis.transactionsWithSubmittedStuck.length > 0) {
      oThis._notifyDevelopers();
    }
  },

  /**
   * Sets the lockId for this particular process.
   *
   * @returns {number}
   */
  getLockId: function() {
    const oThis = this;
    return parseFloat(oThis.lockId + '.' + oThis.processId);
  },

  /**
   * Returns the model to be used.
   *
   * @returns {*}
   */
  getLockableModel: function() {
    return TransactionMetaModel;
  },

  /**
   * Returns the whereClause array.
   *
   * @returns {*[]}
   */
  getQuery: function() {
    const oThis = this;

    return ['status=? AND updated_at >= NOW() - INTERVAL (?) MINUTE', oThis.submittedStatus, oThis.intervalInMinutes];
  },

  /**
   * Gets the max number of rows to be processed.
   *
   * @returns {Number}
   */
  getNoOfRowsToProcess: function() {
    const oThis = this;

    return oThis.noOfRowsToProcess || 1000;
  },

  /**
   * Fetches the web3InteractObject by using configStrategy of groupId.
   *
   * @returns {Promise<void>}
   * @private
   */
  _getWeb3InteractObject: async function() {
    const oThis = this;

    const utilityGethType = 'read_only',
      strategyByGroupHelperObj = new StrategyByGroupHelper(oThis.groupId),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(utilityGethType);

    // Fetch configStrategy.
    oThis.configStrategy = configStrategyResp.data;

    const ic = new InstanceComposer(oThis.configStrategy),
      web3InteractFactory = ic.getWeb3InteractHelper();

    // Get object of web3.
    oThis.web3Interact = web3InteractFactory.getInstance('utility', oThis.configStrategy.OST_UTILITY_GETH_WS_PROVIDER);
  },

  /**
   * Fetches the transactions whose status is submitted and which were last updated before a certain time interval.
   *
   * @returns {Promise<void>}
   * @private
   */
  _getSubmittedTransactionsFromTxMeta: async function() {
    const oThis = this;

    // Fetch submitted transactions from transaction_meta table.
    oThis.submittedTransactions = await new TransactionMetaModel()
      .select('transaction_hash, created_at')
      .where(['status=? AND updated_at >= NOW() - INTERVAL (?) MINUTE', oThis.submittedStatus, oThis.intervalInMinutes])
      .fire();
  },

  /**
   * Fetches the transaction information from geth.
   *
   * @returns {Promise<void>}
   * @private
   */
  _getTransactionsFromGeth: async function() {
    const oThis = this;

    // Loop over submittedTransactions found from transaction_meta table.
    for (let index = 0; index < oThis.submittedTransactions.length; index++) {
      let transactionHash = oThis.submittedTransactions[index].transaction_hash,
        transactionDetails = await oThis.web3Interact.getTransaction(transactionHash);

      // Did not find transaction details.
      if (!transactionDetails) {
        oThis.transactionsToBeResubmitted.push(transactionHash);
      }
      // Found transactions stuck with Submitted status in the DB but are available on geth.
      else {
        oThis.transactionsWithSubmittedStuck.push(transactionHash);
      }
    }
  },

  /**
   * Sets nextRetryTimeStamp if transactionToBeResubmitted has at least 1 transaction.
   *
   * @returns {Promise<void>}
   * @private
   */
  _setNextRetryTimeStamp: async function() {
    const oThis = this;

    // Setting next_retry_timestamp value to 10 seconds from the current time.
    const nextRetryTimeStamp = Math.floor(Date.now() / 1000) + 10;

    // Set next_retry_timestamp in the DB.
    await new TransactionMetaModel()
      .update(['next_retry_timestamp=(?)', nextRetryTimeStamp])
      .where(['transaction_hash IN (?)', oThis.transactionsToBeResubmitted])
      .fire();

    logger.info('Transactions to be resubmitted were updated in the table.');
  },

  /**
   * Notifies developers if some transactions are stuck in submitted status even though they are available on Geth.
   *
   * @private
   */
  _notifyDevelopers: function() {
    const oThis = this;

    // Setting current time to (current time - submittedStuckInterval) minutes.
    let currentTime = new Date();
    currentTime.setMinutes(currentTime.getMinutes() - oThis.submittedStuckInterval);

    // Loop over transactionsWithSubmittedStatus.
    for (let index = 0; index < oThis.transactionsWithSubmittedStuck.length; index++) {
      let createdAtTime = new Date(oThis.transactionsWithSubmittedStuck[index].created_at);

      if (createdAtTime < currentTime) {
        oThis.transactionsToBeNotifiedAbout.push(oThis.transactionsWithSubmittedStuck[index].transaction_hash);
      }
    }

    // Notify developers.
    if (oThis.transactionsToBeNotifiedAbout.length > 0) {
      logger.notify(
        'e_c_l_rct',
        'Some transaction hashes are stuck in submitted status in transaction_meta table.',
        oThis.transactionsToBeNotifiedAbout
      );
    }
  }
};

Object.assign(ReconfirmTransactionsKlass.prototype, ReconfirmTransactionsKlassPrototype);

InstanceComposer.registerShadowableClass(ReconfirmTransactionsKlass, 'getReconfirmTransactionsKlass');

module.exports = ReconfirmTransactionsKlass;
