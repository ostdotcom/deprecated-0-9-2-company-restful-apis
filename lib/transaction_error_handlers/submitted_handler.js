'use strict';

/**
 * This script handles the transactions which are in submitted status in transaction_meta table for a long time.
 * It has two responsibilities:
 * 1. If a transaction in table is not found on geth, it resubmits the transaction and updates the specific transaction
 *    entry in the table.
 * 2. If a transaction is found in table as well as on geth, it sends an email to developers notifying them about such
 *    transactions and updates the specific transaction entry in the table.
 *
 * @module lib/transaction_error_handlers/submitted_handler
 */

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  web3InteractFactory = require(rootPrefix + '/lib/web3/interact/ws_interact'),
  ResubmitRawTx = require(rootPrefix + '/module_overrides/common/resend_raw_tx'),
  transactionMetaConst = require(rootPrefix + '/lib/global_constant/transaction_meta'),
  StrategyByClientHelper = require(rootPrefix + '/helpers/config_strategy/by_client_id');

require(rootPrefix + '/app/models/transaction_log');

/**
 * @constructor
 *
 * @param {Array} txMetaRows: rows of queued tx from txMeta table
 */
const SubmittedHandlerKlass = function(txMetaRows) {
  const oThis = this;

  oThis.lockId = 0;
  oThis.txMetaRows = txMetaRows;
  oThis.submittedStuckInterval = 5; // Time in minutes.

  oThis.txHashToTxMetaIdMap = {}; // Tx hash and id mapping.
  oThis.txUuidToClientIdMap = {}; // Transaction uuid and client mapping.
  oThis.clientIdToTxHashesMap = {}; // Client and transaction hash mapping.
  oThis.clientRelatedMap = {}; // Client and objects mapping.
  oThis.txHashToTxUuidMap = {}; // Tx hash and uuid mapping.

  oThis.lockIds = []; // Array of lockIds.
  oThis.txMetaRowsBatch = []; // Array of tx meta rows in a batch.
  oThis.invalidTxIds = []; // Array of tx ids which fail validations.
  oThis.transactionsToBeNotifiedAbout = []; // Array of txs which are available on Geth as well.
  oThis.transactionHashesWithSubmittedStuck = []; // Array of tx hashes which are available on geth as well.
  oThis.transactionUuidsToBeResubmitted = []; // Array of tx uuids which need to be resubmitted.
  oThis.transactionHashesToBeResubmitted = []; // // Array of tx hashes which need to be resubmitted.
  oThis.transactionIdsToBeResubmitted = []; // Array of tx ids which need to be resubmitted.
  oThis.transactionIdsWithSubmittedStuck = []; // Array of tx ids which are available on geth.
};

const SubmittedHandlerKlassPrototype = {
  /**
   * Main performer for the class.
   *
   * @returns {Promise<T>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().then(
      function() {},
      async function(error) {
        logger.error('lib/transaction_error_handlers/submitted_handler.js::perform::catch');
        logger.error(error);
      }
    );
  },

  /**
   * Async performer for the class.
   *
   * @returns {Promise<void>}
   */
  asyncPerform: async function() {
    const oThis = this;

    // Validate txMetaRows.
    await oThis._validate();

    // invalidTxIds has some entries.
    if (oThis.invalidTxIds.length > 0) {
      logger.error('Following tx_meta ids are invalid: ', oThis.invalidTxIds);
      oThis.lockIds = [...new Set(oThis.lockIds)];

      // Remove lock on all rows.
      for (let index = 0; index < oThis.lockIds.length; index++) {
        await new TransactionMetaModel().releaseLock(oThis.lockIds[index]);
      }
      return Promise.reject('Invalid input.');
    }

    // Populate necessary objects.
    await oThis._createConfigStrategyAndObjectsForClients();

    // Fetch transactions from geth.
    await oThis._getTransactionsFromGeth();

    // transactionHashesWithSubmittedStuck has transactions.
    if (oThis.transactionHashesWithSubmittedStuck.length > 0) {
      oThis._notifyDevelopers();
      await oThis._releaseLock(oThis.transactionIdsWithSubmittedStuck);
    }
    // transactionHashesToBeResubmitted has transactions.
    if (oThis.transactionHashesToBeResubmitted.length > 0) {
      await oThis._resubmitGethNotFoundTxs();
    }
  },

  /**
   * This function validates the txMetaRows.
   *
   * @private
   */
  _validate: function() {
    const oThis = this;

    for (let index = 0; index < oThis.txMetaRows.length; index++) {
      let txMetaRow = oThis.txMetaRows[index];

      // Validate the transaction meta row.
      if (!oThis._validateTxMetaRow(txMetaRow)) {
        oThis.invalidTxIds.push(txMetaRow.id);
      }
    }
  },

  /**
   * Validator function which validates the status of the transaction and the lockId.
   *
   * @param tx_meta_row
   * @returns {boolean}
   * @private
   */
  _validateTxMetaRow: function(tx_meta_row) {
    const oThis = this;

    // Set lockId from the first transaction meta row.
    if (!oThis.lockId) {
      oThis.lockId = tx_meta_row.lock_id;
    }

    oThis.lockIds.push(tx_meta_row.lock_id);

    // Validate status of row. Status should be submitted. Also validate that all the rows have the same lockIds.
    // Implicit type conversion from string to int on the right hand of conditional.
    return (
      tx_meta_row.status === +transactionMetaConst.invertedStatuses[transactionMetaConst.submitted] &&
      tx_meta_row.lock_id === oThis.lockId
    );
  },

  /**
   * Check whether promise for getTransactionFromGeth was resolved or not and populate relevant objects.
   *
   * @param {Number} client_id
   * @param {Array} client_tx_hashes
   * @param {Array} resolved_promises
   * @private
   */
  _decideResubmitOrNotify: function(client_id, client_tx_hashes, resolved_promises) {
    const oThis = this;

    oThis.clientRelatedMap[client_id].transactionHashesToBeResubmitted = [];

    for (let index = 0; index < client_tx_hashes.length; index++) {
      let transactionHash = client_tx_hashes[index];

      // Found transactions stuck with Submitted status in the DB but are available on geth.
      if (resolved_promises[index]) {
        oThis.transactionHashesWithSubmittedStuck.push(transactionHash);
        oThis.transactionIdsWithSubmittedStuck.push(oThis.txHashToTxMetaIdMap[transactionHash]);
      }
      // Did not find transaction details.
      else {
        oThis.transactionHashesToBeResubmitted.push(transactionHash);
        oThis.transactionIdsToBeResubmitted.push(oThis.txHashToTxMetaIdMap[transactionHash]);
        oThis.clientRelatedMap[client_id].transactionHashesToBeResubmitted.push(transactionHash);
      }
    }
  },

  /**
   * This function creates the web3InteractObject and transactionLogModel objects.
   *
   * @returns {Promise<void>}
   * @private
   */
  _createConfigStrategyAndObjectsForClients: async function() {
    const oThis = this;

    // Loop over all txMetaRows and prepare a mapping of client to txUuids.
    for (let index = 0; index < oThis.txMetaRows.length; index++) {
      let txMetaRow = oThis.txMetaRows[index];

      // Create mapping of transaction Uuids and clientIds.
      oThis.txUuidToClientIdMap[txMetaRow.transaction_uuid] = txMetaRow.client_id;

      // Create mapping of transaction hashes and tableIds.
      oThis.txHashToTxMetaIdMap[txMetaRow.transaction_hash] = txMetaRow.id;

      // Create mapping of clientIds and transaction hashes.
      oThis.clientIdToTxHashesMap[txMetaRow.client_id] = oThis.clientIdToTxHashesMap[txMetaRow.client_id] || [];
      oThis.clientIdToTxHashesMap[txMetaRow.client_id].push(txMetaRow.transaction_hash);

      // Create mapping of transaction hashes and clientIds.
      oThis.txHashToTxUuidMap[txMetaRow.transaction_hash] = txMetaRow.transaction_uuid;
    }

    // Get all unique clientIds.
    let clientIds = Object.keys(oThis.clientIdToTxHashesMap);

    // Get configStrategy for all clients and create their objects.
    for (let index = 0; index < clientIds.length; index++) {
      let clientId = clientIds[index];
      let strategyByClientHelperObj = new StrategyByClientHelper(clientId),
        configStrategyResp = await strategyByClientHelperObj.get();

      // Fetch configStrategy and create objects.
      const configStrategy = configStrategyResp.data,
        ic = new InstanceComposer(configStrategy),
        transactionLogModel = ic.getTransactionLogModel();

      // Get object of web3.
      const web3Interact = web3InteractFactory.getInstance('utility', configStrategy.OST_UTILITY_GETH_WS_PROVIDER);

      oThis.clientRelatedMap[clientId] = {};
      oThis.clientRelatedMap[clientId].web3Interact = web3Interact;
      oThis.clientRelatedMap[clientId].transactionLogModel = transactionLogModel;
      oThis.clientRelatedMap[clientId].shardName = configStrategy.TRANSACTION_LOG_SHARD_NAME;
      oThis.clientRelatedMap[clientId].gethUrl = configStrategy.OST_UTILITY_GETH_WS_PROVIDER;
    }
  },

  /**
   * Fetches the transaction information from geth.
   *
   * @returns {Promise<void>}
   * @private
   */
  _getTransactionsFromGeth: async function() {
    const oThis = this;

    // For every client.
    for (let clientId in oThis.clientRelatedMap) {
      // Get transaction hashes from oThis.clientIdToTxHashesMap.
      let clientTxHashes = oThis.clientIdToTxHashesMap[clientId],
        transactionFromGethPromiseArray = [];

      for (let index = 0; index < clientTxHashes.length; index++) {
        // Fetch transactionDetails from geth.
        let transactionHash = clientTxHashes[index];
        transactionFromGethPromiseArray.push(
          oThis.clientRelatedMap[clientId].web3Interact.getTransaction(transactionHash)
        );
      }
      // Wait for promise to resolve for transactions of a particular client.
      let resolvedPromisesTransactions = await Promise.all(transactionFromGethPromiseArray);
      oThis._decideResubmitOrNotify(clientId, clientTxHashes, resolvedPromisesTransactions);
    }
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
    for (let index = 0; index < oThis.transactionHashesWithSubmittedStuck.length; index++) {
      let createdAtTime = new Date(oThis.transactionHashesWithSubmittedStuck[index].created_at);

      if (createdAtTime < currentTime) {
        oThis.transactionsToBeNotifiedAbout.push(oThis.transactionHashesWithSubmittedStuck[index].transaction_hash);
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
  },

  /**
   * Fetch details from transactionLog.
   *
   * @returns {Promise<void>}
   * @private
   */
  _fetchFromTransactionLog: async function(clientId, transactionUuids) {
    const oThis = this;

    let txLogResponse = await new oThis.clientRelatedMap[clientId].transactionLogModel({
      client_id: clientId,
      shard_name: oThis.clientRelatedMap[clientId].shardName
    }).batchGetItem(transactionUuids);

    return Promise.resolve(txLogResponse);
  },

  /**
   *
   * @param {Object} transactionsToBeResubmitted
   * @returns {Promise<void>}
   * @private
   */
  _resubmitTransaction: async function(transactionsToBeResubmitted) {
    const oThis = this;

    // Loop over all the transactions found.
    for (let transactionUuid in transactionsToBeResubmitted) {
      // If raw_transaction exists in the map.
      if (transactionsToBeResubmitted[transactionUuid].raw_transaction) {
        // Get rawTx and gethUrl.
        let rawTx = JSON.parse(transactionsToBeResubmitted[transactionUuid].raw_transaction),
          clientId = oThis.txUuidToClientIdMap[transactionUuid],
          gethUrl = oThis.clientRelatedMap[clientId].gethUrl;

        let transactionId = oThis.txHashToTxMetaIdMap[transactionsToBeResubmitted[transactionUuid].transaction_hash];

        // Re-submit transaction.
        let resendRawTxsObj = new ResubmitRawTx(rawTx, gethUrl);
        resendRawTxsObj.perform().then(
          function() {
            // Release lock.
            oThis._releaseLock([transactionId]);
          },
          function() {
            logger.error('Could not resubmit transaction. Error: ', err, '\nRemoving lock.');
            // Release lock.
            oThis._releaseLock([transactionId]);
          }
        );
      }
    }
  },

  /**
   * Resubmit unknown transactions once again.
   *
   * @returns {Promise}
   * @private
   */
  _resubmitGethNotFoundTxs: async function() {
    const oThis = this,
      batchSize = 50;

    // For all clients.
    for (let clientId in oThis.clientRelatedMap) {
      let transactionHashesToBeResubmitted = oThis.clientRelatedMap[clientId].transactionHashesToBeResubmitted,
        transactionUuidsToBeResubmitted = [];

      // Loop over transactionHashesToBeResubmitted.
      for (let index = 0; index < transactionHashesToBeResubmitted.length; index++) {
        let txHash = transactionHashesToBeResubmitted[index];
        transactionUuidsToBeResubmitted.push(oThis.txHashToTxUuidMap[txHash]);
      }

      // Split into batches of size defined by batchSize.
      while (transactionUuidsToBeResubmitted.length) {
        // Split transactionUuids into batches.
        let transactionUuidsInBatch = transactionUuidsToBeResubmitted.splice(0, batchSize);

        // Fetch all the transactionLog information of a particular client.
        // Get transactionLogModel object of the specific client.
        let transactionLogResponse = await oThis._fetchFromTransactionLog(clientId, transactionUuidsInBatch);

        await oThis._resubmitTransaction(transactionLogResponse.data);
      }
    }
  },

  /**
   * Release lock.
   *
   * @param {Array} transactionIdsToBeReleased
   * @returns {Promise<void>}
   * @private
   */
  _releaseLock: async function(transactionIdsToBeReleased) {
    const oThis = this;

    const nextActionAtTimeStamp =
        Math.floor(Date.now() / 1000) + transactionMetaConst.statusActionTime[transactionMetaConst.submitted],
      whereOptions = ['id IN (?)', transactionIdsToBeReleased],
      updateOptions = ['next_action_at = ? , retry_count = retry_count + 1', nextActionAtTimeStamp];

    new TransactionMetaModel().releaseLock(oThis.lockId, whereOptions, updateOptions);
  }
};

Object.assign(SubmittedHandlerKlass.prototype, SubmittedHandlerKlassPrototype);

module.exports = SubmittedHandlerKlass;
