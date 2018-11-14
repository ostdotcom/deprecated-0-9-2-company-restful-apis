'use strict';

const rootPrefix = '../..',
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  transactionMetaConstants = require(rootPrefix + '/lib/global_constant/transaction_meta.js');
(TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta')),
  (InstanceComposer = require(rootPrefix + '/instance_composer'));

require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/lib/cache_multi_management/transaction_log');
require(rootPrefix + '/app/models/transaction_log');

const TransferSTPrimeKlass = function(params) {
  const oThis = this;

  oThis.transactionUuid = params.transaction_uuid;
  oThis.clientId = params.client_id;
  oThis.transactionLogId = params.transaction_log_id;
};

TransferSTPrimeKlass.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error(`${__filename}::perform::catch`);
      logger.error(error);

      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        return responseHelper.error({
          internal_error_identifier: 's_t_stpt_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  asyncPerform: async function() {
    const oThis = this,
      transactionLogModel = oThis.ic().getTransactionLogModel(),
      transactionLogCache = oThis.ic().getTransactionLogCache(),
      configStrategy = oThis.ic().configStrategy;

    let transactionFetchResponse = await new transactionLogCache({
      uuids: [oThis.transactionUuid],
      client_id: oThis.clientId
    }).fetch();

    // check if the transaction log uuid is same as that passed in the params, otherwise error out
    if (transactionFetchResponse.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_et_21',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let transactionLog = transactionFetchResponse.data[oThis.transactionUuid];

    if (!transactionLog) {
      return responseHelper.error({
        internal_error_identifier: 's_t_stpt_2',
        api_error_identifier: 'transaction_log_invalid',
        debug_options: {}
      });
    }

    const transferSTPrimeInput = {
      sender_address: transactionLog.from_address,
      sender_passphrase: 'no_password',
      recipient_address: transactionLog.to_address,
      amount_in_wei: transactionLog.amount_in_wei.toString(10),
      options: { returnType: 'txHash', tag: '' }
    };

    const platformProvider = oThis.ic().getPlatformProvider(),
      openSTPlaform = platformProvider.getInstance();

    const transferSTPrimeBalanceObj = new openSTPlaform.services.transaction.transfer.simpleTokenPrime(
      transferSTPrimeInput
    );
    delete transferSTPrimeInput.sender_passphrase;

    let transferResponse = await transferSTPrimeBalanceObj.perform();

    if (transferResponse.isFailure()) {
      await oThis.updateParentTransactionLog(transactionLogConst.failedStatus, null, transferResponse.toHash());

      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_stpt_3',
          api_error_identifier: 'stp_transfer_failed',
          debug_options: {}
        })
      );
    }

    let transferTransactionHash = transferResponse.data.transaction_hash;

    // insert into transaction meta table
    await new TransactionMetaModel().insertRecord({
      transaction_hash: transferTransactionHash,
      kind: new TransactionMetaModel().invertedKinds[transactionLogConst.stpTransferTransactionType],
      client_id: transactionLog.client_id,
      chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
      transaction_uuid: transactionLog.transaction_uuid,
      status: transactionMetaConstants.invertedStatuses[transactionMetaConstants.submitted]
    });

    logger.debug('stp tranafer tx hash::', transferTransactionHash);

    await oThis.updateParentTransactionLog(transactionLogConst.waitingForMiningStatus, transferTransactionHash);

    return Promise.resolve(
      responseHelper.successWithData({ input_params: transferSTPrimeInput, transaction_hash: transferTransactionHash })
    );
  },

  /**
   * Update Transaction log.
   *
   * @param statusString
   * @param transactionHash
   * @param errorData
   */
  updateParentTransactionLog: function(statusString, transactionHash, errorData) {
    const oThis = this,
      statusInt = transactionLogConst.invertedStatuses[statusString],
      transactionLogModel = oThis.ic().getTransactionLogModel();

    var dataToUpdate = { transaction_uuid: oThis.transactionUuid, status: statusInt };

    if (transactionHash) {
      dataToUpdate['transaction_hash'] = transactionHash;
    }
    if (errorData) {
      try {
        dataToUpdate['error_code'] = errorData.err.internal_id;
      } catch (error) {
        dataToUpdate['error_code'] = 's_t_stpt_4';
      }
    }

    return new transactionLogModel({
      client_id: oThis.clientId,
      shard_name: oThis.ic().configStrategy.TRANSACTION_LOG_SHARD_NAME
    }).updateItem(dataToUpdate);
  }
};

InstanceComposer.registerShadowableClass(TransferSTPrimeKlass, 'getTransferSTPrimeClass');

module.exports = TransferSTPrimeKlass;
