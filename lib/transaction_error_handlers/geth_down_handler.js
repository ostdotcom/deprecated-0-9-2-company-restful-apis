'use strict';
/**
 * This class takes array of Tx Meta rows as input.
 * Flow:
 * 1. Change Transaction meta status to queued.
 * 2. Call transfer_bt once again on the transaction.
 *
 * @module
 */

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_client_id'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  transactionMetaConstants = require(rootPrefix + '/lib/global_constant/transaction_meta'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/transactions/transfer_bt');

/**
 *
 * tx_meta_rows - rows of queued tx from txMeta table
 * @constructor
 */
const GethDownHandlerKlass = function(tx_meta_rows) {
  const oThis = this;

  oThis.txMetaRows = tx_meta_rows;
};

const GethDownHandlerKlassPrototype = {
  /**
   *
   * @returns {Promise<T>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error('lib/transaction_error_handlers/geth_down_handler.js::perform::catch');
      logger.error(error);
    });
  },

  /**
   *
   * @returns {Promise<*>}
   */
  asyncPerform: async function() {
    const oThis = this;

    if (oThis.txMetaRows.length === 0) {
      logger.log('Transactions not provided.');
      return Promise.reject();
    }

    let txMetaIdsArray = [],
      txMetaLockIds = {},
      clientToTxUuidMap = {};

    for (let index = 0; index < oThis.txMetaRows.length; index++) {
      let txMetaRow = oThis.txMetaRows[index];
      txMetaIdsArray.push(txMetaRow.id);
      txMetaLockIds[txMetaRow.transaction_uuid] = txMetaRow.lock_id;
      clientToTxUuidMap[txMetaRow.client_id] = clientToTxUuidMap[txMetaRow.client_id] || [];
      clientToTxUuidMap[txMetaRow.client_id].push(txMetaRow.transaction_uuid);
    }

    // Mark all transactions as queued
    let timePeriodInSeconds = transactionMetaConstants.statusActionTime[transactionMetaConstants.queued],
      currentTimeStampInSeconds = Math.floor(new Date().getTime() / 1000),
      next_action_at = currentTimeStampInSeconds + timePeriodInSeconds;

    await new TransactionMetaModel()
      .update([
        'status = ?, next_action_at = ?',
        transactionMetaConstants.invertedStatuses[transactionMetaConstants.queued],
        next_action_at
      ])
      .where(['id IN (?)', txMetaIdsArray])
      .fire();

    //fetch config for each client and submit transactions once again
    for (let clientId in clientToTxUuidMap) {
      let configStrategyHelper = new ConfigStrategyHelperKlass(clientId),
        configStrategyRsp = await configStrategyHelper.get(),
        configStrategy = configStrategyRsp.data,
        ic = new InstanceComposer(configStrategy);

      let transferBtKlass = ic.getTransferBtClass();

      let txUuids = clientToTxUuidMap[clientId];

      let promisesArray = [];
      for (let i = 0; i < txUuids.length; i++) {
        let txUuid = txUuids[i],
          txParams = { transactionUuid: txUuid, clientId: clientId };

        var promise = new Promise(function(onResolve, onReject) {
          new transferBtKlass(txParams)
            .perform()
            .then(function() {
              oThis._releaseTransactionLock(txUuid, txMetaLockIds[txUuid]);
              onResolve();
            })
            .catch(function() {
              oThis._releaseTransactionLock(txUuid, txMetaLockIds[txUuid]);
              onResolve();
            });
        });

        promisesArray.push(promise);
      }

      await Promise.all(promisesArray);
    }
  },

  _releaseTransactionLock: async function(txUuid, lockId) {
    await new TransactionMetaModel().releaseLock(lockId, ['transaction_uuid = ?', txUuid]);
  }
};

Object.assign(GethDownHandlerKlass.prototype, GethDownHandlerKlassPrototype);

module.exports = GethDownHandlerKlass;
