'use strict';
/**
 * This class the array of Tx Meta rows as input.
 * It has two responsibilities :
 * 1. In transaction_meta table: marks 'status' as 'failed' and sets 'next_action_at' to 'NULL'.
 * 2. In transaction_log table: marks 'status' as 'failed'.
 *
 * @module
 */

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_client_id'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  transactionMetaConstants = require(rootPrefix + '/lib/global_constant/transaction_meta'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/app/models/transaction_log');

/**
 *
 * tx_meta_rows - rows of queued tx from txMeta table
 * @constructor
 */
const QueuedHandlerKlass = function(tx_meta_rows) {
  const oThis = this;

  oThis.txMetaRows = tx_meta_rows;
};

const QueuedHandlerKlassPrototype = {
  /**
   *
   * @returns {Promise<T>}
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

    let txMetaIdsArray = [],
      clientToTxUuidMap = {};

    for (let index = 0; index < oThis.txMetaRows.length; index++) {
      let txMetaRow = oThis.txMetaRows[index];
      txMetaIdsArray.push(txMetaRow.id);
      clientToTxUuidMap[txMetaRow.client_id] = clientToTxUuidMap[txMetaRow.client_id] || [];
      clientToTxUuidMap[txMetaRow.client_id].push(txMetaRow.transaction_uuid);
    }

    //fetch config for each client and update txLog status to 'failed'
    for (let clientId in clientToTxUuidMap) {
      let configStrategyHelper = new ConfigStrategyHelperKlass(clientId),
        configStrategyRsp = await configStrategyHelper.get(),
        configStrategy = configStrategyRsp.data,
        ic = new InstanceComposer(configStrategy);

      let transactionLogModel = ic.getTransactionLogModel();

      let txUuids = clientToTxUuidMap[clientId],
        failedStatusForTxLog = transactionLogConst.invertedStatuses[transactionLogConst.failedStatus];

      let promisesArray = [];
      for (let i = 0; i < txUuids.length; i++) {
        let txUuid = txUuids[i],
          txLogUpdateParams = { transaction_uuid: txUuid, status: parseInt(failedStatusForTxLog) };
        promisesArray.push(
          new transactionLogModel({
            client_id: clientId,
            shard_name: configStrategy.TRANSACTION_LOG_SHARD_NAME
          }).updateItem(txLogUpdateParams, true)
        );
      }

      await Promise.all(promisesArray);
    }

    let failedStatusForTxMeta = transactionMetaConstants.invertedStatuses[transactionMetaConstants.failed],
      nextActionAtValue = null,
      whereClause = ['id IN (?)', txMetaIdsArray],
      updateItems = ['status = ?, next_action_at = ?', failedStatusForTxMeta, nextActionAtValue],
      lockId = oThis.txMetaRows[0].lock_id,
      txMetaQueryResponse = await new TransactionMetaModel().releaseLock(lockId, whereClause, updateItems);

    if (!txMetaQueryResponse) {
      logger.log('Update transaction meta table failed.');
      return Promise.reject();
    }
  }
};

Object.assign(QueuedHandlerKlass.prototype, QueuedHandlerKlassPrototype);

module.exports = QueuedHandlerKlass;
