'use strict';

/**
 * Service to Execute transaction.
 *
 * @module app/services/transaction/execute
 */

const openSTNotification = require('@openstfoundation/openst-notification'),
  uuid = require('uuid');

const rootPrefix = '../../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  clientTransactionTypeConst = require(rootPrefix + '/lib/global_constant/client_transaction_types'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy'),
  RmqQueueConstants = require(rootPrefix + '/lib/global_constant/rmq_queue'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  configStrategyHelper = new ConfigStrategyHelperKlass();

require(rootPrefix + '/lib/cache_management/client_transaction_type/by_name');
require(rootPrefix + '/lib/cache_management/client_transaction_type/by_id');
require(rootPrefix + '/lib/cache_multi_management/managedAddresses');
require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure');
require(rootPrefix + '/lib/cache_management/client_branded_token');
require(rootPrefix + '/app/models/transaction_log');
require(rootPrefix + '/lib/economy_user_balance');
require(rootPrefix + '/lib/providers/price_oracle');
require(rootPrefix + '/lib/cache_management/process_queue_association');

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
const ExecuteTransactionService = function(params) {
  const oThis = this;

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
  oThis.fromUserTokenBalance = 0;
};

ExecuteTransactionService.prototype = {
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
   * @return {Promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this;

    await oThis._fetchFromBtCache();

    await oThis._fetchFromBtSecureCache();

    await oThis._fetchFromClientTransactionTypeCache();

    await oThis._validateOptionallyMandatoryParams();

    await oThis._validateUsers();

    await oThis._getSenderBalance();

    await oThis._validateFromUserBalance();

    await oThis._createTransactionLog();

    // Transaction would be set in background & response would be returned with uuid.
    await oThis.enqueueTxForExecution();

    return Promise.resolve(responseHelper.successWithData(oThis.transactionLogData));
  },

  /**
   * Fetch Branded token info from cache using the client id
   *
   * Sets oThis.tokenSymbol
   *
   * @return {Promise<result>}
   */
  _fetchFromBtCache: async function() {
    const oThis = this,
      BTCacheKlass = oThis.ic().getClientBrandedTokenCache();

    const btCacheFetchResponse = await new BTCacheKlass({ clientId: oThis.clientId }).fetch();
    if (btCacheFetchResponse.isFailure()) return Promise.reject(btCacheFetchResponse);

    oThis.tokenSymbol = btCacheFetchResponse.data.symbol;

    if (!oThis.tokenSymbol) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_e_2',
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
   * Sets oThis.clientBrandedToken
   *
   * @return {Promise<result>}
   */
  _fetchFromBtSecureCache: async function() {
    const oThis = this,
      BTSecureCacheKlass = oThis.ic().getClientBrandedTokenSecureCache();

    const btSecureCacheFetchResponse = await new BTSecureCacheKlass({ tokenSymbol: oThis.tokenSymbol }).fetch();
    if (btSecureCacheFetchResponse.isFailure()) return Promise.reject(btSecureCacheFetchResponse);

    if (oThis.clientId != btSecureCacheFetchResponse.data.client_id) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_e_3',
          api_error_identifier: 'unauthorized_for_other_client',
          debug_options: {}
        })
      );
    }

    // Client Token has not been set if worker uuid or token address or airdrop address not present.
    if (
      !btSecureCacheFetchResponse.data.token_erc20_address ||
      !btSecureCacheFetchResponse.data.airdrop_contract_address
    ) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_e_4',
          api_error_identifier: 'token_not_setup',
          debug_options: {}
        })
      );
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
   * @return {Promise<result>}
   */
  _fetchFromClientTransactionTypeCache: async function() {
    const oThis = this;

    // fetch the transaction kind record
    if (oThis.transactionKind) {
      const ClientTransactionTypeFromNameCache = oThis.ic().getClientTransactionTypeByNameCache();

      let clientTransactionTypeCacheFetchResponse = await new ClientTransactionTypeFromNameCache({
        client_id: oThis.clientId,
        transaction_kind: oThis.transactionKind
      }).fetch();
      if (clientTransactionTypeCacheFetchResponse.isFailure())
        return Promise.reject(clientTransactionTypeCacheFetchResponse);

      oThis.transactionTypeRecord = clientTransactionTypeCacheFetchResponse.data;
    } else if (oThis.actionId) {
      const ClientTransactionTypeFromIdCache = oThis.ic().getClientTransactionTypeByIdCache();
      let clientTransactionTypeCacheFetchResponse = await new ClientTransactionTypeFromIdCache({
        id: oThis.actionId
      }).fetch();
      if (clientTransactionTypeCacheFetchResponse.isFailure()) {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 's_t_e_24',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['invalid_action_id'],
            debug_options: {}
          })
        );
      }

      oThis.transactionTypeRecord = clientTransactionTypeCacheFetchResponse.data;
    } else {
      // following should never happen.
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_19',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_action_id'],
          debug_options: {}
        })
      );
    }

    // check action status
    if (oThis.transactionTypeRecord.status != clientTransactionTypeConst.activeStatus) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_5',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_transactionkind'],
          debug_options: {}
        })
      );
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
   * @return {Promise<result>}
   */
  _validateOptionallyMandatoryParams: async function() {
    const oThis = this;

    if (oThis.transactionTypeRecord.currency_type === clientTransactionTypeConst.btCurrencyType) {
      if (!commonValidator.isVarNull(oThis.amount) && !commonValidator.validateBtAmount(oThis.amount)) {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 's_t_e_22',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['out_of_bound_transaction_bt_value'],
            debug_options: {}
          })
        );
      }
    }

    if (oThis.transactionTypeRecord.currency_type === clientTransactionTypeConst.usdCurrencyType) {
      if (!commonValidator.isVarNull(oThis.amount) && !commonValidator.validateUsdAmount(oThis.amount)) {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 's_t_e_23',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['out_of_bound_transaction_usd_value'],
            debug_options: {}
          })
        );
      }
    }

    // in case of arbitrary amount, amount should be passed in the params.
    if (
      commonValidator.isVarTrue(oThis.transactionTypeRecord.arbitrary_amount) &&
      commonValidator.isVarNull(oThis.amount)
    ) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_6',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_amount'],
          debug_options: {}
        })
      );
    }

    //in case of non arbitrary amount, amount should NOT be passed in the params.
    if (
      commonValidator.isVarFalse(oThis.transactionTypeRecord.arbitrary_amount) &&
      !commonValidator.isVarNull(oThis.amount)
    ) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_8',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_amount'],
          debug_options: {}
        })
      );
    }

    if (!commonValidator.isVarNull(oThis.amount) && !commonValidator.validateAmount(oThis.amount)) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_21',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_amount'],
          debug_options: {}
        })
      );
    }

    /* Do amount validations only above this code */
    oThis.amount = !commonValidator.isVarNull(oThis.amount) ? parseFloat(oThis.amount) : null;

    if (oThis.transactionTypeRecord.kind == clientTransactionTypeConst.userToUserKind) {
      // in case of arbitrary commission percent, commission percent should be passed in the params.
      if (
        commonValidator.isVarTrue(oThis.transactionTypeRecord.arbitrary_commission_percent) &&
        commonValidator.isVarNull(oThis.commissionPercent)
      ) {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 's_t_e_7',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['invalid_commission_percent'],
            debug_options: {}
          })
        );
      }

      // in case of arbitrary commission percent, commission percent should be passed in the params.
      if (
        commonValidator.isVarFalse(oThis.transactionTypeRecord.arbitrary_commission_percent) &&
        !commonValidator.isVarNull(oThis.commissionPercent)
      ) {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 's_t_e_9',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['invalid_commission_percent'],
            debug_options: {}
          })
        );
      }

      if (!commonValidator.commissionPercentValid(oThis.commissionPercent)) {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 's_t_e_24',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['invalid_commission_percent'],
            debug_options: {}
          })
        );
      }
    } else {
      if (!commonValidator.isVarNull(oThis.commissionPercent)) {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 's_t_e_23',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['invalid_commission_percent'],
            debug_options: {}
          })
        );
      }
    }

    return responseHelper.successWithData({});
  },

  /**
   * Validate Users
   *
   * @return {Promise<result>}
   */
  _validateUsers: async function() {
    const oThis = this,
      ManagedAddressCacheKlass = oThis.ic().getManagedAddressCache();

    if (
      oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToUserKind &&
      !oThis.fromUuid &&
      !oThis.toUuid
    ) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_25',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_from_user_id', 'invalid_to_user_id'],
          debug_options: {}
        })
      );
    }

    if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToCompanyKind && !oThis.fromUuid) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_26',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_from_user_id'],
          debug_options: {}
        })
      );
    }

    if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.companyToUserKind && !oThis.toUuid) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_27',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_to_user_id'],
          debug_options: {}
        })
      );
    }

    if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.userToCompanyKind && !oThis.toUuid) {
      oThis.toUuid = oThis.clientBrandedToken.reserve_address_uuid;
    }

    if (oThis.transactionTypeRecord.kind === clientTransactionTypeConst.companyToUserKind && !oThis.fromUuid) {
      oThis.fromUuid = oThis.clientBrandedToken.reserve_address_uuid;
    }

    // check if the sender same as recipient
    if (oThis.fromUuid === oThis.toUuid) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_t_e_10',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_from_user_id', 'invalid_to_user_id'],
          debug_options: {}
        })
      );
    }

    const managedAddressCacheFetchResponse = await new ManagedAddressCacheKlass({
      uuids: [oThis.fromUuid, oThis.toUuid, oThis.clientBrandedToken.reserve_address_uuid]
    }).fetch();

    if (managedAddressCacheFetchResponse.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_e_11',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    oThis.fromUserObj = managedAddressCacheFetchResponse.data[oThis.fromUuid];
    if (
      !oThis.fromUserObj ||
      oThis.fromUserObj.client_id != oThis.clientId ||
      oThis.fromUserObj.status !== managedAddressesConst.activeStatus
    ) {
      return Promise.reject(oThis._invalid_from_user_id_error('s_t_e_12'));
    }
    // Fetch userId from the obj.
    oThis.fromUserId = oThis.fromUserObj.id;

    oThis.toUserObj = managedAddressCacheFetchResponse.data[oThis.toUuid];
    if (
      !oThis.toUserObj ||
      oThis.toUserObj.client_id != oThis.clientId ||
      oThis.toUserObj.status !== managedAddressesConst.activeStatus
    ) {
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
   * Get From user available balance
   *
   * @return {promise<>}
   */
  _getSenderBalance: async function() {
    const oThis = this,
      EconomyUserBalanceKlass = oThis.ic().getEconomyUserBalance();

    // Fetch Airdrop Balance of users
    const ethereumAddress = oThis.fromUserObj.ethereum_address,
      economyUserBalance = new EconomyUserBalanceKlass({
        client_id: oThis.clientId,
        ethereum_addresses: [ethereumAddress]
      }),
      userBalance = await economyUserBalance.perform();

    if (!userBalance.isFailure()) {
      oThis.fromUserTokenBalance = userBalance.data[ethereumAddress].tokenBalance;
    }

    return Promise.resolve({});
  },

  /**
   * Validate from user has sufficient balance o transfer.
   *
   * @return {promise<>}
   */
  _validateFromUserBalance: async function() {
    const oThis = this,
      amount = basicHelper.convertToWei(oThis.amount || oThis.transactionTypeRecord.currency_value),
      commissionPercent = oThis.commissionPercent || oThis.transactionTypeRecord.commission_percent;

    let transferBtAmountInWei = null;

    logger.debug('---amount--', amount);

    logger.debug('---oThis.transactionTypeRecord--', oThis.transactionTypeRecord);

    if (oThis.transactionTypeRecord.currency_type === clientTransactionTypeConst.usdCurrencyType) {
      let ostPriceCacheKlass = oThis.ic().getOstPricePointsCache(),
        ostPrices = await new ostPriceCacheKlass().fetch();

      if (ostPrices.isFailure()) {
        return Promise.reject(ostPrices);
      }

      logger.debug('---ostPrices--', ostPrices);

      let ostToUSDBn = basicHelper.convertToBigNumber(ostPrices['data']['OST']['USD']),
        usdToBt = basicHelper.convertToBigNumber(oThis.clientBrandedToken.conversion_factor).div(ostToUSDBn);

      transferBtAmountInWei = basicHelper.convertToBigNumber(amount).mul(usdToBt);
    } else {
      transferBtAmountInWei = basicHelper.convertToBigNumber(amount);
    }

    logger.debug('---transferBtAmountInWei--', transferBtAmountInWei);

    // Get conversion rate
    let commissionAmount = '0';
    if (!commonValidator.isVarNull(commissionPercent)) {
      commissionAmount = transferBtAmountInWei.mul(
        basicHelper.convertToBigNumber(commissionPercent).div(basicHelper.convertToBigNumber(100))
      );
    }
    logger.debug('---commissionAmount--', commissionAmount);
    const requiredBtAmountInWei = transferBtAmountInWei.plus(basicHelper.convertToBigNumber(commissionAmount));

    logger.debug('---oThis.fromUuid---', oThis.fromUuid);
    logger.debug('---oThis.transactionTypeRecord---', oThis.transactionTypeRecord);
    logger.debug('---requiredBtAmountInWei--', requiredBtAmountInWei);
    logger.debug('---oThis.fromUserTokenBalance--', oThis.fromUserTokenBalance);

    if (
      basicHelper
        .convertToBigNumber(requiredBtAmountInWei)
        .gt(basicHelper.convertToBigNumber(oThis.fromUserTokenBalance))
    ) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_e_29',
          api_error_identifier: 'insufficient_funds',
          error_config: errorConfig
        })
      );
    }

    return Promise.resolve();
  },

  /**
   * Create Entry in transaction logs
   *
   * Sets oThis.transactionLogId
   *
   * @return {Promise<result>}
   */
  _createTransactionLog: async function() {
    const oThis = this,
      transactionLogModel = oThis.ic().getTransactionLogModel(),
      configStrategy = oThis.ic().configStrategy;

    oThis.transactionLogData = {
      transaction_uuid: oThis.transactionUuid,
      client_id: oThis.clientId,
      client_token_id: oThis.clientBrandedToken.id,
      transaction_type: transactionLogConst.invertedTransactionTypes[transactionLogConst.tokenTransferTransactionType],
      amount: oThis.amount,
      from_address: oThis.fromUserObj.ethereum_address,
      from_uuid: oThis.fromUuid,
      to_address: oThis.toUserObj.ethereum_address,
      to_uuid: oThis.toUuid,
      token_symbol: oThis.tokenSymbol,
      action_id: oThis.actionId,
      commission_percent: oThis.commissionPercent,
      gas_price: basicHelper.convertToBigNumber(configStrategy.OST_UTILITY_GAS_PRICE).toString(10),
      status: transactionLogConst.invertedStatuses[transactionLogConst.processingStatus],
      created_at: Date.now(),
      updated_at: Date.now()
    };

    let start_time = Date.now();

    await new transactionLogModel({
      client_id: oThis.clientId,
      shard_name: configStrategy.TRANSACTION_LOG_SHARD_NAME
    }).updateItem(oThis.transactionLogData);

    console.log('------- Time taken', (Date.now() - start_time) / 1000);

    return responseHelper.successWithData({});
  },

  /**
   * Enqueue transaction for execution
   *
   * @return {Promise<result>}
   */
  enqueueTxForExecution: async function() {
    const oThis = this;

    const configStrategyRsp = await configStrategyHelper.getConfigStrategy(oThis.clientId),
      configStrategy = configStrategyRsp.data,
      ic = new InstanceComposer(configStrategy);

    const ProcessQueueAssociationCacheKlass = ic.getProcessQueueAssociationCache(),
      processQueueAssociationRsp = await new ProcessQueueAssociationCacheKlass({
        client_id: oThis.clientId
      }).fetch();

    let workingProcessIds = processQueueAssociationRsp.data.workingProcessDetails;

    let index = oThis.fromUserId % workingProcessIds.length,
      topicName = RmqQueueConstants.executeTxTopicPrefix + workingProcessIds[index].queue_name_suffix,
      workerUuid = workingProcessIds[index].workerUuid;
    // Pass the workerUuid for transfer_bt class.

    const setToRMQ = await openSTNotification.publishEvent.perform({
      topics: [topicName], // topicName for distributor queue
      publisher: 'OST',
      message: {
        kind: RmqQueueConstants.executeTx,
        payload: {
          transactionUuid: oThis.transactionUuid,
          clientId: oThis.clientId,
          workerUuid: workerUuid
        }
      }
    });

    //if could not set to RMQ run in async.
    if (setToRMQ.isFailure() || setToRMQ.data.publishedToRmq == 0) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_e_18',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Invalid to user id error
   *
   * @return {result}
   */
  _invalid_to_user_id_error: function(internalId) {
    return responseHelper.paramValidationError({
      internal_error_identifier: internalId,
      api_error_identifier: 'invalid_api_params',
      params_error_identifiers: ['invalid_to_user_id'],
      debug_options: {}
    });
  },

  /**
   * Invalid from user id error
   *
   * @return {result}
   */
  _invalid_from_user_id_error: function(internalId) {
    return responseHelper.paramValidationError({
      internal_error_identifier: internalId,
      api_error_identifier: 'invalid_api_params',
      params_error_identifiers: ['invalid_from_user_id'],
      debug_options: {}
    });
  }
};
InstanceComposer.registerShadowableClass(ExecuteTransactionService, 'getExecuteTransactionService');
module.exports = ExecuteTransactionService;
