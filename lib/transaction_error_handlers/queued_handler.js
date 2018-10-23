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
  baseKlass = require(rootPrefix + '/executables/continuous/lockables/base'),
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
 * @param params
 * @param params.tx_meta_rows - rows of queued tx from txMeta table
 * @constructor
 */
const QueuedHandlerKlass = function(params) {
  const oThis = this;

  oThis.txMetaRows = params.tx_meta_rows;
};

QueuedHandlerKlass.prototype = Object.create(baseKlass.prototype);

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
      clientIdsArray = [],
      clientToTxUuidMap = {};

    for (let index = 0; index < oThis.txMetaRows.length; index++) {
      let txMetaRow = oThis.txMetaRows[index];
      txMetaIdsArray.push(txMetaRow.id);
      clientIdsArray.push(txMetaRow.client_id);
      clientToTxUuidMap[txMetaRow.client_id] = txMetaRow.transaction_uuid;
    }

    //to get distinct clientIds
    clientIdsArray = [...new Set(clientIdsArray)];

    let failedStatusForTxMeta = transactionMetaConstants.invertedStatuses[transactionMetaConstants.failed],
      nextActionAtValue = null,
      txMetaQueryResponse = await new TransactionMetaModel()
        .update({ status: failedStatusForTxMeta, next_action_at: nextActionAtValue })
        .where(['id IN (?)', txMetaIdsArray])
        .fire();

    if (!txMetaQueryResponse) {
      logger.log('Update transaction meta table failed.');
      return Promise.reject();
    }

    //fetch config for each client and update txLog status to 'failed'
    for (let index = 0; index < clientIdsArray.length; index++) {
      let clientId = clientIdsArray[index],
        configStrategyHelper = new ConfigStrategyHelperKlass(clientId),
        configStrategyRsp = await configStrategyHelper.get(),
        configStrategy = configStrategyRsp.data,
        ic = new InstanceComposer(configStrategy);

      let transactionLogModel = ic.getTransactionLogModel();

      let txUuid = clientToTxUuidMap[clientId],
        failedStatusForTxLog = transactionLogConst.invertedStatuses[transactionLogConst.failedStatus],
        txLogUpdateParams = { transaction_uuid: txUuid, status: parseInt(failedStatusForTxLog) },
        updateItemResponse = await new transactionLogModel({
          client_id: clientId,
          shard_name: configStrategy.TRANSACTION_LOG_SHARD_NAME
        }).updateItem(txLogUpdateParams, true);

      if (updateItemResponse.isFailure()) {
        return updateItemResponse;
      }
    }
  }
};

Object.assign(QueuedHandlerKlass.prototype, QueuedHandlerKlassPrototype);

InstanceComposer.registerShadowableClass(QueuedHandlerKlass, 'getMonitorWorkersGasKlass');

module.exports = QueuedHandlerKlass;
