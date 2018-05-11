"use strict";

/**
 * Service to Execute STP transfer.
 *
 * @module app/services/stp_transfer/execute
 */

const openSTNotification = require('@openstfoundation/openst-notification')
  , uuid = require("uuid")
;

const rootPrefix = '../../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , BTSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , BTCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , transactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , STPTransferEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/stp_transfer')
  , notificationTopics = require(rootPrefix + './lib/global_constant/notification_topics')
;

/**
 * @constructor
 *
 * @param {object} params - service params
 * @param {number} params.client_id (mandatory) - client id
 * @param {string} params.to_address (mandatory) - to address
 * @param {string} params.amount (mandatory) - amount in Weis
 */
const ExecuteSTPTransferService = function (params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
  oThis.toAddress = params.to_address;
  oThis.amountInWei = params.amount;

  oThis.fromAddress = null;

  oThis.transactionLogId = null;
  oThis.clientTokenId = null;
  oThis.transactionUuid = uuid.v4();
  oThis.tokenSymbol = null;
};

ExecuteSTPTransferService.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: function () {
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 's_stp_e_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  /**
   * Async perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function () {
    const oThis = this
    ;

    await oThis._fetchFromBtCache();

    await oThis._fetchFromBtSecureCache();

    await oThis._createTransactionLog();

    // Transaction would be set in background & response would be returned with uuid.
    await oThis.enqueueTxForExecution();

    let dbRecords = await new transactionLogModel().getById([oThis.transactionLogId]);
    const stpTransferEntityFormatter = new STPTransferEntityFormatterKlass(dbRecords[0])
      , stpTransferEntityFormatterRsp = await stpTransferEntityFormatter.perform()
    ;

    const apiResponseData = {
      result_type: 'transfer',
      transaction: stpTransferEntityFormatterRsp.data
    };

    return Promise.resolve(responseHelper.successWithData(apiResponseData));
  },

  /**
   * Fetch Branded token info from cache using the client id
   *
   * Sets oThis.tokenSymbol
   *
   * @return {promise<result>}
   */
  _fetchFromBtCache: async function () {
    const oThis = this
    ;

    const btCacheFetchResponse = await new BTCacheKlass({clientId: oThis.clientId}).fetch();
    if (btCacheFetchResponse.isFailure()) return Promise.reject(btCacheFetchResponse);

    oThis.tokenSymbol = btCacheFetchResponse.data.symbol;

    if (!oThis.tokenSymbol) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stp_e_2',
        api_error_identifier: 'missing_token_symbol',
        debug_options: {client_id: oThis.clientId}
      }));
    }

    return responseHelper.successWithData({});
  },

  /**
   * Fetch from Bt Secure Cache
   *
   * Sets oThis.fromAddress, oThis.clientTokenId
   *
   * @return {promise<result>}
   */
  _fetchFromBtSecureCache: async function () {
    const oThis = this
    ;

    const btSecureCacheFetchResponse = await new BTSecureCacheKlass({tokenSymbol: oThis.tokenSymbol}).fetch();
    if (btSecureCacheFetchResponse.isFailure()) return Promise.reject(btSecureCacheFetchResponse);

    // Client Token has not been set if worker uuid or token address or airdrop address not present.
    if (!btSecureCacheFetchResponse.data.token_erc20_address || !btSecureCacheFetchResponse.data.airdrop_contract_address) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stp_e_3',
        api_error_identifier: 'token_not_setup',
        debug_options: {}
      }));
    }

    oThis.fromAddress = btSecureCacheFetchResponse.data.reserve_address;
    oThis.clientTokenId = btSecureCacheFetchResponse.data.id;

    return responseHelper.successWithData({});
  },

  /**
   * Create Entry in transaction logs
   *
   * Sets oThis.transactionLogId
   *
   * @return {promise<result>}
   */
  _createTransactionLog: async function () {
    const oThis = this
    ;

    let inputParams = {
      from_address: oThis.fromAddress,
      to_address: oThis.toAddress,
      amount_in_wei: oThis.amountInWei
    };

    let insertedRec = await new transactionLogModel().insertRecord({
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      transaction_type: new transactionLogModel().invertedTransactionTypes[transactionLogConst.stpTransferTransactionType],
      input_params: inputParams,
      chain_type: new transactionLogModel().invertedChainTypes[transactionLogConst.utilityChainType],
      status: new transactionLogModel().invertedStatuses[transactionLogConst.processingStatus],
      transaction_uuid: oThis.transactionUuid,
      gas_price: basicHelper.convertToBigNumber(
        chainInteractionConstants.UTILITY_GAS_PRICE
      ).toString(10) // converting hex to base 10
    });

    oThis.transactionLogId = insertedRec.insertId;

    return responseHelper.successWithData({});
  },

  /**
   * Enqueue transaction for execution
   *
   * @return {promise<result>}
   */
  enqueueTxForExecution: async function () {
    const oThis = this
    ;

    let topicName = notificationTopics.stpTransfer;

    const setToRMQ = await openSTNotification.publishEvent.perform(
      {
        topics: [topicName],
        publisher: 'OST',
        message: {
          kind: 'execute_stp_transfer',
          payload: {
            transactionLogId: oThis.transactionLogId,
            transactionUuid: oThis.transactionUuid
          }
        }
      }
    );

    //if could not set to RMQ run in async.
    if (setToRMQ.isFailure() || setToRMQ.data.publishedToRmq == 0) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stp_e_4',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    return Promise.resolve(responseHelper.successWithData({}))
  }
};

module.exports = ExecuteSTPTransferService;