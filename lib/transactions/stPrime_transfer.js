"use strict";

const openStPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = "../.."
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , TransactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.general)
;

const TransferSTPrimeForApproveKlass = function(params){
  const oThis = this;

  oThis.ransactionLogId = params.transaction_log_id;
};

TransferSTPrimeForApproveKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function () {
    const oThis = this
    ;

    return oThis.asyncPerform()
      .catch(function (error) {
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

  asyncPerform: async function(){
    const oThis = this;

    let transactionLog = (new TransactionLogModel().getById([oThis.ransactionLogId]))[0];
    if(!transactionLog) {
      return responseHelper.error({
        internal_error_identifier: 's_t_stpt_2',
        api_error_identifier: 'transaction_log_invalid',
        debug_options: {}
      });
    }

    let receiverAddress = transactionLog.input_params.from_address
      , senderAddress = transactionLog.input_params.from_address;

    const transferSTPrimeInput = {
      sender_address: transactionLog.input_params.from_address,
      sender_passphrase: 'no_password',
      recipient_address: transactionLog.input_params.from_address,
      amount_in_wei: transactionLog.input_params.amount_in_wei.toString(10),
      options: {returnType: 'txHash', tag: ''}
    };

    const transferSTPrimeBalanceObj = new openStPlatform.services.transaction.transfer.simpleTokenPrime(transferSTPrimeInput);
    delete transferSTPrimeInput.sender_passphrase;

    let transferResponse = await transferSTPrimeBalanceObj.perform();

    if (transferResponse.isFailure()) {
      await new TransactionLogModel().updateRecord(
        oThis.transactionLogId,
        {
          status: new TransactionLogModel().invertedStatuses[transactionLogConst.failedStatus],
          formatted_receipt: transferResponse
        });

      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_stpt_3',
        api_error_identifier: 'stp_transfer_failed',
        debug_options: {}
      }));
    }

    let transferTransactionHash = transferResponse.data.transaction_hash;

    logger.debug('stp tranafer tx hash::', transferTransactionHash);

    await new TransactionLogModel().updateRecord(
      oThis.transactionLogId,
      {
        status: new TransactionLogModel().invertedStatuses[transactionLogConst.waitingForMiningStatus],
        transaction_hash: transferTransactionHash
      });

    return Promise.resolve(responseHelper.successWithData({input_params: transferSTPrimeInput, transaction_hash: transferTransactionHash}));
  }
};

module.exports = TransferSTPrimeForApproveKlass;