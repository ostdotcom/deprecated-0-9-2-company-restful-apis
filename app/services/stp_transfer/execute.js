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
  , notificationTopics = require(rootPrefix + '/lib/global_constant/notification_topics')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , autoScalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
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
            internal_error_identifier: '`s_stp_e_1`',
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

    await oThis._validateParams();

    await oThis._createTransactionLog();

    // Transaction would be set in background & response would be returned with uuid.
    await oThis.enqueueTxForExecution();

    let dbResponse = await new transactionLogModel({
      client_id: oThis.clientId,
      ddb_service: ddbServiceObj,
      auto_scaling: autoScalingServiceObj
    }).batchGetItem([oThis.transactionUuid]);

    if (!dbResponse.data) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stp_e_10',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }

    let dbRecord = dbResponse.data[oThis.transactionUuid];

    return responseHelper.successWithData(dbRecord);
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
   * Validate params
   *
   * @return {promise<result>}
   */
  _validateParams: async function () {
    const oThis = this
    ;

    let isValidationFailed = false;

    let amount_in_ost = null;

    if (!commonValidator.isVarNull(oThis.amountInWei)) {
      if (!(oThis.amountInWei > 0)) {
        return Promise.reject(responseHelper.paramValidationError({
          internal_error_identifier: 's_stp_e_4',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_amount'],
          debug_options: {}
        }));
      }

      // only non decimal amount is possible.
      if ((basicHelper.convertToBigNumber(oThis.amountInWei).modulo(basicHelper.convertToBigNumber(1))).gt(basicHelper.convertToBigNumber(0))) {
        return Promise.reject(responseHelper.paramValidationError({
          internal_error_identifier: 's_stp_e_5',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_amount'],
          debug_options: {}
        }));
      }

      amount_in_ost = basicHelper.convertToNormal(oThis.amountInWei);

      amount_in_ost = parseFloat(amount_in_ost);
    } else {
      isValidationFailed = true;
    }

    if ( amount_in_ost <= 0 || amount_in_ost >= 100 ) {
      isValidationFailed = true;
    }

    if (isValidationFailed) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_stp_e_6',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_transfer_amount'],
        debug_options: {client_id: oThis.clientId}
      }));
    }


    // check if the sender same as recipient
    if (oThis.fromAddress == oThis.toAddress) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_stp_e_7',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_to_address'],
        debug_options: {client_id: oThis.clientId}
      }));
    }

    if (!commonValidator.validateEthAddress(oThis.toAddress)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_stp_e_8',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_to_address'],
        debug_options: {client_id: oThis.clientId}
      }));
    }
    oThis.toAddress = oThis.toAddress.trim().toLowerCase();

    return Promise.resolve({});
  },

  /**
   * Create Entry in transaction logs
   *
   *
   * @return {promise<result>}
   */
  _createTransactionLog: async function () {
    const oThis = this
    ;

    let dataToInsert = {
      client_id: oThis.clientId,
      transaction_uuid: oThis.transactionUuid,
      transaction_type: transactionLogConst.invertedTransactionTypes[transactionLogConst.stpTransferTransactionType],
      client_token_id: oThis.clientTokenId,
      gas_price: basicHelper.convertToBigNumber(
        chainInteractionConstants.UTILITY_GAS_PRICE
      ).toString(10), // converting hex to base 10
      status: transactionLogConst.invertedStatuses[transactionLogConst.processingStatus],
      created_at: Date.now(),
      updated_at: Date.now(),
      from_address: oThis.fromAddress,
      to_address: oThis.toAddress,
      amount_in_wei: oThis.amountInWei
    };

    let insertedRec = await new transactionLogModel({
      client_id: oThis.clientId,
      ddb_service: ddbServiceObj,
      auto_scaling: autoScalingServiceObj
    }).updateItem(dataToInsert);

    if (!insertedRec.data) {
       return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stp_e_7',
        api_error_identifier: 'ddb_insert_failed',
        debug_options: {client_id: oThis.clientId}
      }));
    }

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
          kind: 'background_job',
          payload: {
            transaction_uuid: oThis.transactionUuid,
            client_id: oThis.clientId
          }
        }
      }
    );

    //if could not set to RMQ run in async.
    if (setToRMQ.isFailure() || setToRMQ.data.publishedToRmq == 0) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_stp_e_9',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    return Promise.resolve(responseHelper.successWithData({}))
  }
};

module.exports = ExecuteSTPTransferService;