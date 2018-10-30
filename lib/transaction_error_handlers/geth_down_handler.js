'use strict';
/**
 * This class takes array of Tx Meta rows as input.
 *
 * Flow:
 * 1. Change Transaction meta status to queued.
 * 2. Call transfer_bt once again on the transaction.
 *
 * @module lib/transaction_error_handlers/geth_down_handler
 */

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_client_id'),
  transactionMetaConstants = require(rootPrefix + '/lib/global_constant/transaction_meta');

// registering the objects and classes in instance composer
require(rootPrefix + '/lib/transactions/transfer_bt');

/**
 * @constructor
 *
 * @param {Array<object>} tx_meta_rows: rows of queued tx from txMeta table
 */
const GethDownHandlerKlass = function(tx_meta_rows) {
  const oThis = this;

  oThis.txMetaRows = tx_meta_rows;
};

const GethDownHandlerKlassPrototype = {
  /**
   * Main performer for the class.
   *
   * @returns {Promise}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error('lib/transaction_error_handlers/geth_down_handler.js::perform::catch');
      logger.error(error);
    });
  },

  /**
   * Async performer for the class.
   *
   * @returns {Promise<*>}
   */
  asyncPerform: async function() {
    const oThis = this;

    if (oThis.txMetaRows.length === 0) {
      logger.log('Transactions not provided.');
      return Promise.reject();
    }

    let txMetaIds = [],
      txUuidToLockIdMap = {},
      clientIdToTxUuidsMap = {},
      anyRejections = false,
      lockIdMap = {};

    for (let index = 0; index < oThis.txMetaRows.length; index++) {
      let txMetaRow = oThis.txMetaRows[index];
      txMetaIds.push(txMetaRow.id);
      txUuidToLockIdMap[txMetaRow.transaction_uuid] = txMetaRow.lock_id;
      clientIdToTxUuidsMap[txMetaRow.client_id] = clientIdToTxUuidsMap[txMetaRow.client_id] || [];
      clientIdToTxUuidsMap[txMetaRow.client_id].push(txMetaRow.transaction_uuid);
      lockIdMap[txMetaRow.lock_id] = 1;

      if (
        txMetaRow.status != transactionMetaConstants.invertedStatuses[transactionMetaConst.geth_down] &&
        txMetaRow.status != transactionMetaConstants.invertedStatuses[transactionMetaConst.geth_out_of_sync]
      ) {
        anyRejections = true;
      }
    }
    let lockIds = Object.keys(lockIdMap);
    if (lockIds.length > 1) {
      anyRejections = true;
    }

    if (anyRejections) {
      for (let index = 0; index < lockIds; index++) {
        await new TransactionMetaModel().releaseLock(lockIds[index]);
      }
      return Promise.reject();
    }

    // Marking all transactions as queued.
    await oThis._markAllAsQueued(txMetaIds);

    // Fetch config for each client and submit transactions once again.
    for (let clientId in clientIdToTxUuidsMap) {
      let transferBtKlass = await oThis._getTransferBtKlass(clientId);

      let txUuids = clientIdToTxUuidsMap[clientId];

      let promisesArray = [];
      for (let i = 0; i < txUuids.length; i++) {
        let txUuid = txUuids[i],
          txParams = { transactionUuid: txUuid, clientId: clientId };

        let promise = new Promise(function(onResolve, onReject) {
          new transferBtKlass(txParams)
            .perform()
            .then(function() {
              oThis._releaseTransactionLock(txUuid, txUuidToLockIdMap[txUuid]);
              onResolve();
            })
            .catch(function() {
              oThis._releaseTransactionLock(txUuid, txUuidToLockIdMap[txUuid]);
              onResolve();
            });
        });

        promisesArray.push(promise);
      }

      await Promise.all(promisesArray);
    }
  },

  /**
   * Release Transaction Lock
   *
   * @param txUuid {string} - transaction uuid
   * @param lockId {string} - lock id
   * @returns {Promise}
   *
   * @private
   */
  _releaseTransactionLock: async function(txUuid, lockId) {
    await new TransactionMetaModel().releaseLock(lockId, ['transaction_uuid = ?', txUuid]);
  },

  /**
   * Mark all as queued
   *
   * @param txMetaIds {Array<Number>} - Array of tx meta ids
   * @returns {Promise}
   */
  _markAllAsQueued: function(txMetaIds) {
    let timePeriodInSeconds = transactionMetaConstants.statusActionTime[transactionMetaConstants.queued],
      currentTimeStampInSeconds = Math.floor(new Date().getTime() / 1000),
      next_action_at = currentTimeStampInSeconds + timePeriodInSeconds;

    return new TransactionMetaModel()
      .update([
        'status = ?, next_action_at = ?, retry_count = retry_count + 1',
        transactionMetaConstants.invertedStatuses[transactionMetaConstants.queued],
        next_action_at
      ])
      .where(['id IN (?)', txMetaIds])
      .fire();
  },

  /**
   * Get transfer Bt Class from ic
   *
   * @param clientId {number} - client id
   * @returns {Promise}
   */
  _getTransferBtKlass: async function(clientId) {
    let configStrategyHelper = new ConfigStrategyHelperKlass(clientId),
      configStrategyRsp = await configStrategyHelper.get(),
      configStrategy = configStrategyRsp.data,
      ic = new InstanceComposer(configStrategy);

    return ic.getTransferBtClass();
  }
};

Object.assign(GethDownHandlerKlass.prototype, GethDownHandlerKlassPrototype);

module.exports = GethDownHandlerKlass;
