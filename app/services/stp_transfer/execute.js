'use strict';

/**
 * Service to Execute STP transfer.
 *
 * @module app/services/stp_transfer/execute
 */

const uuidV4 = require('uuid/v4');

const rootPrefix = '../../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  notificationTopics = require(rootPrefix + '/lib/global_constant/notification_topics'),
  ConnectionTimeoutConst = require(rootPrefix + '/lib/global_constant/connection_timeout');

require(rootPrefix + '/lib/providers/notification');
require(rootPrefix + '/app/models/transaction_log');
require(rootPrefix + '/lib/cache_multi_management/transaction_log');
require(rootPrefix + '/lib/cache_management/client_branded_token');
require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure');

/**
 * @constructor
 *
 * @param {object} params - service params
 * @param {number} params.client_id (mandatory) - client id
 * @param {string} params.to_address (mandatory) - to address
 * @param {string} params.amount (mandatory) - amount in Weis
 */
const ExecuteSTPTransferService = function(params) {
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.toAddress = params.to_address;
  oThis.amountInWei = params.amount;

  oThis.fromAddress = null;

  oThis.transactionLogId = null;
  oThis.transactionLog = null;
  oThis.clientTokenId = null;
  oThis.transactionUuid = uuidV4();
  oThis.tokenSymbol = null;
};

ExecuteSTPTransferService.prototype = {
  /**
   * Perform
   *
   * @return {Promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
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
   * @return {Promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this;

    if (basicHelper.isMainSubEnvironment()) {
      let response = responseHelper.error({
        internal_error_identifier: 's_stp_e_11',
        api_error_identifier: 'transfer_prohibited',
        debug_options: {}
      });

      return Promise.reject(response);
    }

    const configStrategy = oThis.ic().configStrategy;

    await oThis._fetchFromBtCache();

    await oThis._fetchFromBtSecureCache();

    await oThis._validateParams();

    await oThis._createTransactionLog();

    // Transaction would be set in background & response would be returned with uuid.
    await oThis.enqueueTxForExecution();

    oThis.transactionLog['utility_chain_id'] = configStrategy.OST_UTILITY_CHAIN_ID;

    return responseHelper.successWithData(oThis.transactionLog);
  },

  /**
   * Fetch Branded token info from cache using the client id
   *
   * Sets oThis.tokenSymbol
   *
   * @return {Promise<result>}
   */
  _fetchFromBtCache: async function() {
    const oThis = this;
    const BTCacheKlass = oThis.ic().getClientBrandedTokenCache();
    const btCacheFetchResponse = await new BTCacheKlass({ clientId: oThis.clientId }).fetch();
    if (btCacheFetchResponse.isFailure()) return Promise.reject(btCacheFetchResponse);

    oThis.tokenSymbol = btCacheFetchResponse.data.symbol;

    if (!oThis.tokenSymbol) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_stp_e_2',
          api_error_identifier: 'missing_token_symbol',
          debug_options: { client_id: oThis.clientId }
        })
      );
    }

    return responseHelper.successWithData({});
  },

  /**
   * Fetch from Bt Secure Cache
   *
   * Sets oThis.fromAddress, oThis.clientTokenId
   *
   * @return {Promise<result>}
   */
  _fetchFromBtSecureCache: async function() {
    const oThis = this;
    const BTSecureCacheKlass = oThis.ic().getClientBrandedTokenSecureCache();
    const btSecureCacheFetchResponse = await new BTSecureCacheKlass({ tokenSymbol: oThis.tokenSymbol }).fetch();
    if (btSecureCacheFetchResponse.isFailure()) return Promise.reject(btSecureCacheFetchResponse);

    // Client Token has not been set if worker uuid or token address or airdrop address not present.
    if (
      !btSecureCacheFetchResponse.data.token_erc20_address ||
      !btSecureCacheFetchResponse.data.airdrop_contract_address
    ) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_stp_e_3',
          api_error_identifier: 'token_not_setup',
          debug_options: {}
        })
      );
    }

    oThis.fromAddress = btSecureCacheFetchResponse.data.reserve_address;
    oThis.clientTokenId = btSecureCacheFetchResponse.data.id;

    return responseHelper.successWithData({});
  },

  /**
   * Validate params
   *
   * @return {Promise<result>}
   */
  _validateParams: async function() {
    const oThis = this;

    let isValidationFailed = false;

    let amount_in_ost = null;

    if (!commonValidator.isVarNull(oThis.amountInWei)) {
      if (!(oThis.amountInWei > 0)) {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 's_stp_e_4',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['invalid_amount'],
            debug_options: {}
          })
        );
      }

      // only non decimal amount is possible.
      if (
        basicHelper
          .convertToBigNumber(oThis.amountInWei)
          .modulo(basicHelper.convertToBigNumber(1))
          .gt(basicHelper.convertToBigNumber(0))
      ) {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 's_stp_e_5',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['invalid_amount'],
            debug_options: {}
          })
        );
      }

      amount_in_ost = basicHelper.convertToNormal(oThis.amountInWei);

      amount_in_ost = parseFloat(amount_in_ost);
    } else {
      isValidationFailed = true;
    }

    if (amount_in_ost <= 0 || amount_in_ost >= 100) {
      isValidationFailed = true;
    }

    if (isValidationFailed) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_stp_e_6',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_transfer_amount'],
          debug_options: { client_id: oThis.clientId }
        })
      );
    }

    // check if the sender same as recipient
    if (oThis.fromAddress == oThis.toAddress) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_stp_e_7',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_to_address'],
          debug_options: { client_id: oThis.clientId }
        })
      );
    }

    if (!commonValidator.validateEthAddress(oThis.toAddress)) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_stp_e_8',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_to_address'],
          debug_options: { client_id: oThis.clientId }
        })
      );
    }
    oThis.toAddress = oThis.toAddress.trim().toLowerCase();

    return Promise.resolve({});
  },

  /**
   * Create Entry in transaction logs
   *
   *
   * @return {Promise<result>}
   */
  _createTransactionLog: async function() {
    const oThis = this,
      transactionLogModel = oThis.ic().getTransactionLogModel(),
      transactionLogCache = oThis.ic().getTransactionLogCache(),
      configStrategy = oThis.ic().configStrategy;

    oThis.transactionLog = {
      client_id: oThis.clientId,
      transaction_uuid: oThis.transactionUuid,
      transaction_type: transactionLogConst.invertedTransactionTypes[transactionLogConst.stpTransferTransactionType],
      client_token_id: oThis.clientTokenId,
      gas_price: basicHelper.convertToBigNumber(configStrategy.OST_UTILITY_GAS_PRICE).toString(10), // converting hex to base 10
      status: transactionLogConst.invertedStatuses[transactionLogConst.processingStatus],
      created_at: Date.now(),
      updated_at: Date.now(),
      from_address: oThis.fromAddress,
      to_address: oThis.toAddress,
      amount_in_wei: oThis.amountInWei
    };

    let insertedRec = await new transactionLogModel({
      client_id: oThis.clientId,
      shard_name: configStrategy.TRANSACTION_LOG_SHARD_NAME
    }).updateItem(oThis.transactionLog, false);

    if (insertedRec.isFailure()) {
      return Promise.reject(insertedRec);
    }

    let dataToSetInCache = {};
    dataToSetInCache[oThis.transactionUuid] = oThis.transactionLog;
    // not intentionally waiting for cache set to happen
    await new transactionLogCache({
      uuids: [oThis.transactionUuid],
      client_id: oThis.clientId
    }).setCache(dataToSetInCache);

    return responseHelper.successWithData({});
  },

  /**
   * Enqueue transaction for execution
   *
   * @return {Promise<result>}
   */
  enqueueTxForExecution: async function() {
    const oThis = this;

    let topicName = notificationTopics.stpTransfer;

    const notificationProvider = oThis.ic().getNotificationProvider(),
      openStNotification = notificationProvider.getInstance({
        connectionWaitSeconds: ConnectionTimeoutConst.appServer
      }),
      payload = {
        transaction_uuid: oThis.transactionUuid,
        client_id: oThis.clientId
      };

    const setToRMQ = await openStNotification.publishEvent
      .perform({
        topics: [topicName],
        publisher: 'OST',
        message: {
          kind: 'background_job',
          payload: payload
        }
      })
      .catch(function(err) {
        logger.error('Message for ST Prime transfer was not published. Payload: ', payload, ' Error: ', err);
      });

    // If could not set to RMQ run in async.
    if (setToRMQ.isFailure() || setToRMQ.data.publishedToRmq == 0) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_stp_e_9',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

InstanceComposer.registerShadowableClass(ExecuteSTPTransferService, 'getExecuteSTPTransferService');

module.exports = ExecuteSTPTransferService;
