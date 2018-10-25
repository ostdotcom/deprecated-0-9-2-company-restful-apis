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
 * @param {Array} tx_meta_rows: rows of queued tx from txMeta table
 */
const SubmittedHandlerKlass = function(tx_meta_rows) {
  const oThis = this;

  oThis.lockId = 0;
  oThis.txMetaRows = tx_meta_rows;
  oThis.submittedStuckInterval = 5; // Time in minutes.

  oThis.txHashAndIdMapping = {}; // Tx hash and id mapping.
  oThis.txUuidClientMapping = {}; // Transaction uuid and client mapping.
  oThis.clientTxHashMapping = {}; // Client and transaction hash mapping.
  oThis.clientRelatedMapping = {}; // Client and objects mapping.
  oThis.txHashAndUuidMapping = {}; // Tx hash and uuid mapping.

  oThis.transactionsToBeNotifiedAbout = [];
  oThis.transactionHashesWithSubmittedStuck = [];
  oThis.transactionHashesToBeResubmitted = [];
  oThis.transactionIdsToBeResubmitted = [];
  oThis.transactionIdsWithSubmittedStuck = [];

  oThis.transactionFetchResponse = [];
};

const SubmittedHandlerKlassPrototype = {
  /**
   * Main performer for the class.
   *
   * @returns {Promise<T>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error('lib/transaction_error_handlers/submitted_handler.js::perform::catch');
      logger.error(error);
    });
  },

  /**
   * Async performer for the class.
   *
   * @returns {Promise<void>}
   */
  asyncPerform: async function() {
    const oThis = this;

    await oThis._createConfigStrategyAndObjectsForClients();

    await oThis._getTransactionsFromGeth();

    // transactionHashesWithSubmittedStuck has transactions.
    if (oThis.transactionHashesWithSubmittedStuck.length > 0) {
      oThis._notifyDevelopers();
      await oThis._releaseLock(oThis.transactionIdsWithSubmittedStuck);
    }
    // transactionHashesToBeResubmitted has transactions.
    if (oThis.transactionHashesToBeResubmitted.length > 0) {
      await oThis._fetchFromTransactionLog();
      await oThis._resubmitTransaction(); // This method internally releases lock.
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

    let clientIds = [];

    // Loop over all txMetaRows and prepare a mapping of client to txUuids.
    for (let index = 0; index < oThis.txMetaRows.length; index++) {
      let txMetaRow = oThis.txMetaRows[index];

      // Get lockId.
      oThis.lockId = txMetaRow.lock_id;

      // Get all clientIds.
      clientIds.push(txMetaRow.client_id);

      // Create mapping of transaction Uuids and clientIds.
      oThis.txUuidClientMapping[txMetaRow.transaction_uuid] = txMetaRow.client_id;

      // Create mapping of transaction hashes and tableIds.
      oThis.txHashAndIdMapping[txMetaRow.transaction_hash] = txMetaRow.id;

      // Create mapping of clientIds and transaction hashes.
      oThis.clientTxHashMapping[txMetaRow.client_id] = oThis.clientTxHashMapping[txMetaRow.client_id] || [];
      oThis.clientTxHashMapping[txMetaRow.client_id].push(txMetaRow.transaction_hash);

      // Create mapping of transaction hashes and clientIds.
      oThis.txHashAndUuidMapping[txMetaRow.transaction_hash] = txMetaRow.transaction_uuid;
    }

    // Get all unique clientIds.
    clientIds = [...new Set(clientIds)];

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

      oThis.clientRelatedMapping[clientId] = {};
      oThis.clientRelatedMapping[clientId].web3Interact = web3Interact;
      oThis.clientRelatedMapping[clientId].transactionLogModel = transactionLogModel;
      oThis.clientRelatedMapping[clientId].shardName = configStrategy.TRANSACTION_LOG_SHARD_NAME;
      oThis.clientRelatedMapping[clientId].gethUrl = configStrategy.OST_UTILITY_GETH_WS_PROVIDER;
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
    for (let clientId in oThis.clientRelatedMapping) {
      if (oThis.clientRelatedMapping.hasOwnProperty(clientId)) {
        // Get transaction hashes from oThis.clientTxHashMapping.
        let clientTxHashes = oThis.clientTxHashMapping[clientId];

        for (let index = 0; index < clientTxHashes.length; index++) {
          // Fetch transactionDetails from geth.
          let transactionHash = clientTxHashes[index],
            transactionDetails = await oThis.clientRelatedMapping[clientId].web3Interact.getTransaction(
              transactionHash
            );

          oThis.clientRelatedMapping[clientId].transactionHashesToBeResubmitted =
            oThis.clientRelatedMapping[clientId].transactionHashesToBeResubmitted || [];

          // Did not find transaction details.
          if (!transactionDetails) {
            oThis.transactionHashesToBeResubmitted.push(transactionHash);
            oThis.transactionIdsToBeResubmitted.push(oThis.txHashAndIdMapping[transactionHash]);
            oThis.clientRelatedMapping[clientId].transactionHashesToBeResubmitted.push(transactionHash);
          }
          // Found transactions stuck with Submitted status in the DB but are available on geth.
          else {
            oThis.transactionHashesWithSubmittedStuck.push(transactionHash);
            oThis.transactionIdsWithSubmittedStuck.push(oThis.txHashAndIdMapping[transactionHash]);
          }
        }
      }
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
  _fetchFromTransactionLog: async function() {
    const oThis = this;

    // For all clients.
    for (let clientId in oThis.clientRelatedMapping) {
      let transactionHashesToBeResubmitted = oThis.clientRelatedMapping[clientId].transactionHashesToBeResubmitted,
        transactionUuidsToBeResubmitted = [];

      // Loop over transactionHashesToBeResubmitted.
      for (let index = 0; index < transactionHashesToBeResubmitted.length; index++) {
        let txHash = transactionHashesToBeResubmitted[index];
        transactionUuidsToBeResubmitted.push(oThis.txHashAndUuidMapping[txHash]);
      }

      // Fetch all the transactionLog information of a particular client.
      // Get transactionLogModel object of the specific client.
      oThis.transactionFetchResponse.push(
        await new oThis.clientRelatedMapping[clientId].transactionLogModel({
          client_id: clientId,
          shard_name: oThis.clientRelatedMapping[clientId].shardName
        }).batchGetItem(transactionUuidsToBeResubmitted)
      );
    }
  },

  /**
   * This function resubmits transactions.
   *
   * @returns {Promise<void>}
   * @private
   */
  _resubmitTransaction: async function() {
    const oThis = this;

    let promisesArray = [],
      transactionsToBeResubmitted = oThis.transactionFetchResponse[0].data; // Returns a map.
    // Loop over all the transactions found.
    for (let transactionUuid in transactionsToBeResubmitted) {
      if (transactionsToBeResubmitted.hasOwnProperty(transactionUuid)) {
        // Get rawTx and gethUrl.
        let rawTx = JSON.parse(transactionsToBeResubmitted[transactionUuid].raw_transaction),
          clientId = oThis.txUuidClientMapping[transactionUuid],
          gethUrl = oThis.clientRelatedMapping[clientId].gethUrl;

        // Re-submit transaction.
        let resendRawTxsObj = new ResubmitRawTx(rawTx, gethUrl);
        await resendRawTxsObj.perform();

        // Release lock.
        let transactionId = oThis.txHashAndIdMapping[transactionsToBeResubmitted[transactionUuid].transaction_hash];
        promisesArray.push(oThis._releaseLock([transactionId]));
      }
    }
    await Promise.all(promisesArray);
  },

  /**
   * Release lock.
   *
   * @param {Array} transactionIdsToBeReleased
   * @returns {Promise<void>}
   * @private
   */
  _releaseLock: function(transactionIdsToBeReleased) {
    const oThis = this;

    const nextActionAtTimeStamp =
        Math.floor(Date.now() / 1000) + transactionMetaConst.statusActionTime[transactionMetaConst.submitted],
      whereOptions = ['id IN (?)', transactionIdsToBeReleased];

    const updateOptions = ['next_action_at = ? , retry_count = retry_count + 1', nextActionAtTimeStamp];
    new TransactionMetaModel().releaseLock(oThis.lockId, whereOptions, updateOptions);
  }
};

Object.assign(SubmittedHandlerKlass.prototype, SubmittedHandlerKlassPrototype);

module.exports = SubmittedHandlerKlass;
