'use strict';
/**
 * This script handles the transactions which are in queued status in transaction_meta table for a long time.
 * This class the array of Tx Meta rows as input.
 * It has two responsibilities :
 * 1. In transaction_meta table: marks 'status' as 'failed' and sets 'next_action_at' to 'NULL'.
 * 2. In transaction_log table: marks 'status' as 'failed'.
 *
 * @module lib/transaction_error_handlers/queued_handler
 */

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  transactionMetaConstants = require(rootPrefix + '/lib/global_constant/transaction_meta'),
  transactionLogConstants = require(rootPrefix + '/lib/global_constant/transaction_log'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_client_id');

require(rootPrefix + '/app/models/transaction_log');

/**
 * @constructor
 *
 * @param {Array} txMetaRows: rows of queued tx from txMeta table
 */
const QueuedHandlerKlass = function(txMetaRows) {
  const oThis = this;

  oThis.txMetaRows = txMetaRows || [];
  oThis.lockId = 0;
  oThis.clientIdToTxUuidsMap = {};
};

const QueuedHandlerKlassPrototype = {
  /**
   * Perform
   *
   * @returns {Promise}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error('lib/transaction_error_handlers/queued_handler.js::perform::catch');
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
      logger.log('No queued transactions are present.');
      return Promise.reject();
    }

    let anyRejections = false,
      lockIdMap = {};

    for (let index = 0; index < oThis.txMetaRows.length; index++) {
      let txMetaRow = oThis.txMetaRows[index];

      oThis.clientIdToTxUuidsMap[txMetaRow.client_id] = oThis.clientIdToTxUuidsMap[txMetaRow.client_id] || [];
      oThis.clientIdToTxUuidsMap[txMetaRow.client_id].push(txMetaRow.transaction_uuid);

      lockIdMap[txMetaRow.lock_id] = 1;

      if (txMetaRow.status != transactionMetaConstants.invertedStatuses[transactionMetaConstants.queued]) {
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
      logger.log('Invalid tx rows passed as input.');
      return Promise.reject();
    }

    oThis.lockId = lockIds[0];

    await oThis._updateTransactionLog();
  },

  /**
   * Function that marks transaction_log table 'status' as 'failed'.
   * @private
   */
  _updateTransactionLog: async function() {
    const oThis = this;

    // Fetch config for each client and update txLog status to 'failed'.
    for (let clientId in oThis.clientIdToTxUuidsMap) {
      let configStrategyHelper = new ConfigStrategyHelperKlass(clientId),
        configStrategyRsp = await configStrategyHelper.get(),
        configStrategy = configStrategyRsp.data;

      let ic = new InstanceComposer(configStrategy);

      let transactionLogModel = ic.getTransactionLogModel();

      let txUuids = oThis.clientIdToTxUuidsMap[clientId],
        failedStatusForTxLog = transactionLogConstants.invertedStatuses[transactionLogConstants.failedStatus];

      let promisesArray = [],
        batchNo = 1,
        dynamoQueryBatchSize = 10;

      while (true) {
        let offset = (batchNo - 1) * dynamoQueryBatchSize,
          batchedTxUuids = txUuids.slice(offset, dynamoQueryBatchSize + offset);

        if (batchedTxUuids.length === 0) break;

        for (let i = 0; i < batchedTxUuids.length; i++) {
          let txUuid = batchedTxUuids[i],
            txLogUpdateParams = { transaction_uuid: txUuid, status: parseInt(failedStatusForTxLog) };
          promisesArray.push(
            new transactionLogModel({
              client_id: clientId,
              shard_name: configStrategy.TRANSACTION_LOG_SHARD_NAME
            }).updateItem(txLogUpdateParams, true)
          );
        }

        await Promise.all(promisesArray);

        await oThis._updateTransactionMeta(batchedTxUuids);

        // Resetting batch iteration variables.
        promisesArray = [];
        batchNo = batchNo + 1;
      }
    }
  },

  /**
   * Function that marks transaction_meta table 'status' as 'failed' and sets 'next_action_at' to 'NULL'.
   * @private
   */

  _updateTransactionMeta: async function(txUuids) {
    const oThis = this;

    let failedStatusForTxMeta = transactionMetaConstants.invertedStatuses[transactionMetaConstants.failed],
      nextActionAtValue = null,
      whereClause = ['transaction_uuid IN (?)', txUuids],
      updateItems = ['status = ?, next_action_at = ?', failedStatusForTxMeta, nextActionAtValue],
      lockId = oThis.lockId,
      txMetaQueryResponse = await new TransactionMetaModel().releaseLock(lockId, whereClause, updateItems);

    if (!txMetaQueryResponse) {
      logger.log('Update transaction meta table failed.');
      return Promise.reject();
    }
  }
};

Object.assign(QueuedHandlerKlass.prototype, QueuedHandlerKlassPrototype);

module.exports = QueuedHandlerKlass;
