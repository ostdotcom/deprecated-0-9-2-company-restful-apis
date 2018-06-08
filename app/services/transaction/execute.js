"use strict";

/**
 * Service to Execute transaction.
 *
 * @module app/services/transaction/execute
 */

const openSTNotification = require('@openstfoundation/openst-notification')
  , openStorage = require('@openstfoundation/openst-storage')
  , uuid = require("uuid")
;

const rootPrefix = '../../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ClientTransactionTypeFromNameCache = require(rootPrefix + '/lib/cache_management/client_transaction_type/by_name')
  , ClientTransactionTypeFromIdCache = require(rootPrefix + '/lib/cache_management/client_transaction_type/by_id')
  , clientTransactionTypeConst = require(rootPrefix + '/lib/global_constant/client_transaction_types')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , BTSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , BTCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , transactionLogModel = require(rootPrefix + '/app/models/transaction_log')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , ClientTrxRateCacheKlass = require(rootPrefix + '/lib/cache_management/client_transactions_rate_limit')
  , TransactionEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/transaction')
  , commonValidator = require(rootPrefix + '/lib/validators/common')
  , ClientTransactionTypeModel = require(rootPrefix + '/app/models/client_transaction_type')
  , TransactionLogModelDdb = openStorage.TransactionLogModel
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , autoscalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
;

/**
 * @constructor
 *
 * @param {object} params - service params
 * @param {number} params.client_id (mandatory) - client id
 * @param {string} params.from_user_id (mandatory) - from user uuid
 * @param {string} params.to_user_id (mandatory) - to user uuid
 * @param {string<number>} params.action_id (optional) - id of client_transaction_types table
 * @param {string<number>} params.transaction_kind (optional) - name of the transaction kind
 * @param {string<float>} params.amount (optional) - amount to be sent in the transaction. Depending on the action setup, this is mandatory.
 * @param {string<float>} params.commission_percent (optional) - commission percent to be sent in the transaction. Depending on the action setup, this is mandatory.
 */
const ExecuteTransactionService = function (params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
  oThis.fromUuid = params.from_user_id;
  oThis.toUuid = params.to_user_id;
  oThis.transactionKind = params.transaction_kind;
  oThis.actionId = params.action_id;
  oThis.amount = params.amount;
  oThis.commissionPercent = params.commission_percent;

  oThis.transactionLogData = null;
  oThis.transactionUuid = uuid.v4();
  oThis.tokenSymbol = null;
  oThis.transactionTypeRecord = null;
  oThis.clientBrandedToken = null;
  oThis.toUserObj = null;
  oThis.fromUserObj = null;
};

ExecuteTransactionService.prototype = {
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
            internal_error_identifier: 's_t_e_1',
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

    await oThis._fetchFromClientTransactionTypeCache();

    await oThis._validateOptionallyMandatoryParams();

    await oThis._validateUsers();

    await oThis._createTransactionLog();

    // Transaction would be set in background & response would be returned with uuid.
    await oThis.enqueueTxForExecution();

    const transactionEntityFormatter = new TransactionEntityFormatterKlass(oThis.transactionLogData)
      , transactionEntityFormatterRsp = await transactionEntityFormatter.perform()
    ;

    const apiResponseData = {
      result_type: 'transaction',
      transaction: transactionEntityFormatterRsp.data
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
        internal_error_identifier: 's_t_e_2',
        api_error_identifier: 'missing_token_symbol',
        debug_options: {client_id: oThis.clientId}
      }));
    }

    return responseHelper.successWithData({});
  },

  /**
   * Fetch from Bt Secure Cache
   *
   * Sets oThis.clientBrandedToken
   *
   * @return {promise<result>}
   */
  _fetchFromBtSecureCache: async function () {
    const oThis = this
    ;

    const btSecureCacheFetchResponse = await new BTSecureCacheKlass({tokenSymbol: oThis.tokenSymbol}).fetch();
    if (btSecureCacheFetchResponse.isFailure()) return Promise.reject(btSecureCacheFetchResponse);

    if (oThis.clientId != btSecureCacheFetchResponse.data.client_id) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_e_3',
        api_error_identifier: 'unauthorized_for_other_client',
        debug_options: {}
      }));
    }

    // Client Token has not been set if worker uuid or token address or airdrop address not present.
    if (!btSecureCacheFetchResponse.data.token_erc20_address || !btSecureCacheFetchResponse.data.airdrop_contract_address) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_e_4',
        api_error_identifier: 'token_not_setup',
        debug_options: {}
      }));
    }

    oThis.erc20ContractAddress = btSecureCacheFetchResponse.data.token_erc20_address;
    oThis.clientBrandedToken = btSecureCacheFetchResponse.data;

    return responseHelper.successWithData({});
  },

  /**
   * Fetch from client transaction type cache
   *
   * Sets oThis.transactionTypeRecord
   *
   * @return {promise<result>}
   */
  _fetchFromClientTransactionTypeCache: async function () {
    const oThis = this
    ;

    // fetch the transaction kind record
    if (oThis.transactionKind) {
      let clientTransactionTypeCacheFetchResponse = await (new ClientTransactionTypeFromNameCache({
        client_id: oThis.clientId,
        transaction_kind: oThis.transactionKind
      })).fetch();
      if (clientTransactionTypeCacheFetchResponse.isFailure()) return Promise.reject(clientTransactionTypeCacheFetchResponse);

      oThis.transactionTypeRecord = clientTransactionTypeCacheFetchResponse.data;
    } else if (oThis.actionId) {
      let clientTransactionTypeCacheFetchResponse = await (new ClientTransactionTypeFromIdCache(
        {id: oThis.actionId})).fetch();
      if (clientTransactionTypeCacheFetchResponse.isFailure()) {
        return Promise.reject(responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_24',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_action_id'],
          debug_options: {}
        }));
      }

      oThis.transactionTypeRecord = clientTransactionTypeCacheFetchResponse.data;
    } else {
      // following should never happen.
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_19',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_action_id'],
        debug_options: {}
      }));
    }

    // check action status
    if (oThis.transactionTypeRecord.status != clientTransactionTypeConst.activeStatus) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_5',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_transactionkind'],
        debug_options: {}
      }));
    }

    oThis.actionId = oThis.transactionTypeRecord.id;
    oThis.transactionKind = oThis.transactionTypeRecord.name;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate the commission percent and amount.
   *
   * Sets oThis.transactionTypeRecord
   *
   * @return {promise<result>}
   */
  _validateOptionallyMandatoryParams: async function () {
    const oThis = this
    ;

    if (oThis.transactionTypeRecord.currency_type ==
      new ClientTransactionTypeModel().invertedCurrencyTypes[clientTransactionTypeConst.btCurrencyType]) {
      if (!commonValidator.isVarNull(oThis.amount) && !commonValidator.validateBtAmount(oThis.amount)) {
        return Promise.reject(responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_22',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['out_of_bound_transaction_bt_value'],
          debug_options: {}
        }));
      }
    }

    if (oThis.transactionTypeRecord.currency_type ==
      new ClientTransactionTypeModel().invertedCurrencyTypes[clientTransactionTypeConst.usdCurrencyType]) {
      if (!commonValidator.isVarNull(oThis.amount) && !commonValidator.validateUsdAmount(oThis.amount)) {
        return Promise.reject(responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_23',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['out_of_bound_transaction_usd_value'],
          debug_options: {}
        }));
      }
    }

    // in case of arbitrary amount, amount should be passed in the params.
    if (commonValidator.isVarTrue(oThis.transactionTypeRecord.arbitrary_amount) && commonValidator.isVarNull(oThis.amount)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_6',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_amount'],
        debug_options: {}
      }));
    }

    //in case of non arbitrary amount, amount should NOT be passed in the params.
    if (commonValidator.isVarFalse(oThis.transactionTypeRecord.arbitrary_amount) && !commonValidator.isVarNull(oThis.amount)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_8',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_amount'],
        debug_options: {}
      }));
    }

    if(!commonValidator.isVarNull(oThis.amount) && !commonValidator.validateAmount(oThis.amount)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_21',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_amount'],
        debug_options: {}
      }));
    }

    /* Do amount validations only above this code */

    if (!commonValidator.isVarNull(oThis.amount) && oThis.transactionTypeRecord.currency_type ==
      new ClientTransactionTypeModel().invertedCurrencyTypes[clientTransactionTypeConst.btCurrencyType]) {

      oThis.amount = basicHelper.convertToWei(oThis.amount);
      oThis.amount = basicHelper.formatWeiToString(oThis.amount);
    }

    oThis.amount = !commonValidator.isVarNull(oThis.amount) ? parseFloat(oThis.amount) : null;

    if(oThis.transactionTypeRecord.kind == clientTransactionTypeConst.userToUserKind){
      // in case of arbitrary commission percent, commission percent should be passed in the params.
      if (commonValidator.isVarTrue(oThis.transactionTypeRecord.arbitrary_commission_percent) && commonValidator.isVarNull(oThis.commissionPercent)) {
        return Promise.reject(responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_7',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_commission_percent'],
          debug_options: {}
        }));
      }

      // in case of arbitrary commission percent, commission percent should be passed in the params.
      if (commonValidator.isVarFalse(oThis.transactionTypeRecord.arbitrary_commission_percent) && !commonValidator.isVarNull(oThis.commissionPercent)) {
        return Promise.reject(responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_9',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_commission_percent'],
          debug_options: {}
        }));
      }

      if(!commonValidator.commissionPercentValid(oThis.commissionPercent)) {
        return Promise.reject(responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_24',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_commission_percent'],
          debug_options: {}
        }));
      }

    } else {
      if(!commonValidator.isVarNull(oThis.commissionPercent)){
        return Promise.reject(responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_23',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_commission_percent'],
          debug_options: {}
        }));
      }
    }

    return responseHelper.successWithData({});
  },

  /**
   * Validate Users
   *
   * @return {promise<result>}
   */
  _validateUsers: async function () {
    const oThis = this
    ;

    if ((oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToUserKind) && !oThis.fromUuid && !oThis.toUuid ) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_25',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_from_user_id', 'invalid_to_user_id'],
        debug_options: {}
      }));
    }

    if ((oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToCompanyKind) && !oThis.fromUuid ) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_26',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_from_user_id'],
        debug_options: {}
      }));
    }

    if ((oThis.transactionTypeRecord.kind === clientTransactionTypeConst.companyToUserKind) && !oThis.toUuid ) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_27',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_to_user_id'],
        debug_options: {}
      }));
    }

    if ((oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToCompanyKind) && !oThis.toUuid ) {
      oThis.toUuid = oThis.clientBrandedToken.reserve_address_uuid;
    }

    if ((oThis.transactionTypeRecord.kind === clientTransactionTypeConst.companyToUserKind) && !oThis.fromUuid ) {
      oThis.fromUuid = oThis.clientBrandedToken.reserve_address_uuid;
    }

    // check if the sender same as recipient
    if (oThis.fromUuid == oThis.toUuid) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 's_t_e_10',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_from_user_id', 'invalid_to_user_id'],
        debug_options: {}
      }));
    }

    const managedAddressCacheFetchResponse = await (new ManagedAddressCacheKlass(
      {uuids: [oThis.fromUuid, oThis.toUuid, oThis.clientBrandedToken.reserve_address_uuid]})).fetch();

    if (managedAddressCacheFetchResponse.isFailure()) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_e_11',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    oThis.fromUserObj = managedAddressCacheFetchResponse.data[oThis.fromUuid];
    if (!oThis.fromUserObj || oThis.fromUserObj.client_id != oThis.clientId || oThis.fromUserObj.status != managedAddressesConst.activeStatus) {
      return Promise.reject(oThis._invalid_from_user_id_error('s_t_e_12'));
    }

    oThis.toUserObj = managedAddressCacheFetchResponse.data[oThis.toUuid];
    if (!oThis.toUserObj || oThis.toUserObj.client_id != oThis.clientId || oThis.toUserObj.status != managedAddressesConst.activeStatus) {
      return Promise.reject(oThis._invalid_to_user_id_error('s_t_e_13'));
    }

    if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.companyToUserKind) {
      if (oThis.fromUuid !== oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.reject(oThis._invalid_from_user_id_error('s_t_e_14'));
      }
    } else if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToCompanyKind) {
      if (oThis.toUuid !== oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.reject(oThis._invalid_to_user_id_error('s_t_e_15'));
      }
    } else if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToUserKind) {
      if (oThis.fromUuid === oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.reject(oThis._invalid_from_user_id_error('s_t_e_16'));
      }
      if (oThis.toUuid === oThis.clientBrandedToken.reserve_address_uuid) {
        return Promise.reject(oThis._invalid_to_user_id_error('s_t_e_17'));
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));
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

    oThis.transactionLogData = {
      transaction_uuid: oThis.transactionUuid,
      client_id: oThis.clientId,
      client_token_id: oThis.clientBrandedToken.id,
      transaction_type: new transactionLogModel().invertedTransactionTypes[transactionLogConst.tokenTransferTransactionType],
      amount: oThis.amount,
      from_address: oThis.fromUserObj.ethereum_address,
      from_uuid: oThis.fromUuid,
      to_address: oThis.toUserObj.ethereum_address,
      to_uuid: oThis.toUuid,
      token_symbol: oThis.tokenSymbol,
      action_id: oThis.actionId,
      commission_percent: oThis.commissionPercent,
      gas_price: basicHelper.convertToBigNumber(chainInteractionConstants.UTILITY_GAS_PRICE).toString(10),
      status: new transactionLogModel().invertedStatuses[transactionLogConst.processingStatus],
      created_at: Date.now(),
      updated_at: Date.now()
    };

    await new TransactionLogModelDdb({
      client_id: oThis.clientId,
      ddb_service: ddbServiceObj,
      auto_scaling: autoscalingServiceObj
    }).batchPutItem([oThis.transactionLogData]);

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

    let topicName = 'transaction.execute';

    const rateLimitCrossed = await new ClientTrxRateCacheKlass({client_id: oThis.clientId}).transactionRateLimitCrossed();
    if (rateLimitCrossed.isSuccess() && rateLimitCrossed.data.limitCrossed) {
      topicName = 'slow.transaction.execute'
    }

    let rateLimitCount = rateLimitCrossed.data.rateLimitCount;

    const setToRMQ = await openSTNotification.publishEvent.perform(
      {
        topics: [topicName],
        publisher: 'OST',
        message: {
          kind: 'execute_transaction',
          payload: {
            transactionUuid: oThis.transactionUuid,
            clientId: oThis.clientId,
            rateLimitCount: rateLimitCount
          }
        }
      }
    );

    //if could not set to RMQ run in async.
    if (setToRMQ.isFailure() || setToRMQ.data.publishedToRmq == 0) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_t_e_18',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      }));
    }

    return Promise.resolve(responseHelper.successWithData({}))
  },

  /**
   * Invalid to user id error
   *
   * @return {result}
   */
  _invalid_to_user_id_error: function (internalId) {
    return responseHelper.paramValidationError({
      internal_error_identifier: internalId,
      api_error_identifier: 'invalid_api_params',
      params_error_identifiers: ['invalid_to_user_id'],
      debug_options: {}
    })
  },

  /**
   * Invalid from user id error
   *
   * @return {result}
   */
  _invalid_from_user_id_error: function (internalId) {
    return responseHelper.paramValidationError({
      internal_error_identifier: internalId,
      api_error_identifier: 'invalid_api_params',
      params_error_identifiers: ['invalid_from_user_id'],
      debug_options: {}
    })
  },
};

module.exports = ExecuteTransactionService;