'use strict';

/**
 * Service to Execute transaction.
 *
 * @module app/services/transaction/execute
 */

const uuidV4 = require('uuid/v4');

const rootPrefix = '../../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  RmqQueueConstants = require(rootPrefix + '/lib/global_constant/rmq_queue'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  ConnectionTimeoutConst = require(rootPrefix + '/lib/global_constant/connection_timeout'),
  transactionMetaConstants = require(rootPrefix + '/lib/global_constant/transaction_meta.js'),
  clientTransactionTypeConst = require(rootPrefix + '/lib/global_constant/client_transaction_types'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  configStrategyHelper = new ConfigStrategyHelperKlass();

require(rootPrefix + '/lib/economy_user_balance');
require(rootPrefix + '/app/models/transaction_log');
require(rootPrefix + '/lib/providers/price_oracle');
require(rootPrefix + '/lib/providers/notification');
require(rootPrefix + '/lib/cache_management/client_branded_token');
require(rootPrefix + '/lib/cache_multi_management/transaction_log');
require(rootPrefix + '/lib/cache_multi_management/managedAddresses');
require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure');
require(rootPrefix + '/lib/cache_management/process_queue_association');
require(rootPrefix + '/lib/cache_management/client_transaction_type/by_id');
require(rootPrefix + '/lib/cache_management/client_transaction_type/by_name');

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
  oThis.transactionUuid = uuidV4();
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

    await oThis._insertInTransactionMeta();

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
  _createTransactionLog: async function(workerUuid) {
    const oThis = this,
      transactionLogModel = oThis.ic().getTransactionLogModel(),
      transactionLogCache = oThis.ic().getTransactionLogCache(),
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
      transaction_executor_uuid: workerUuid,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    let start_time = Date.now();
    let updateItemResponse = await new transactionLogModel({
      client_id: oThis.clientId,
      shard_name: configStrategy.TRANSACTION_LOG_SHARD_NAME
    }).updateItem(oThis.transactionLogData, false);

    logger.log('------- Time taken', (Date.now() - start_time) / 1000);
    if (updateItemResponse.isFailure()) {
      return updateItemResponse;
    }

    let dataToSetInCache = {};
    dataToSetInCache[oThis.transactionUuid] = oThis.transactionLogData;
    // not intentionally waiting for cache set to happen
    new transactionLogCache({
      uuids: [oThis.transactionUuid],
      client_id: oThis.clientId
    }).setCache(dataToSetInCache);

    return responseHelper.successWithData({});
  },

  _insertInTransactionMeta: async function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    logger.debug('Inserting transaction in transaction meta table');

    let waitTimeForProcessingSec = transactionMetaConstants.statusActionTime[transactionMetaConstants.queued],
      currentTimeStampInSeconds = new Date().getTime() / 1000,
      nextActionAt = currentTimeStampInSeconds + waitTimeForProcessingSec;

    await new TransactionMetaModel().insertRecord({
      chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
      transaction_hash: null,
      transaction_uuid: oThis.transactionUuid,
      client_id: oThis.clientId,
      next_action_at: nextActionAt,
      status: transactionMetaConstants.invertedStatuses[transactionMetaConstants.queued],
      kind: new TransactionMetaModel().invertedKinds[transactionLogConst.tokenTransferTransactionType]
    });
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

    if (workingProcessIds.length === 0) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_e_20',
          api_error_identifier: 'insufficient_gas',
          debug_options: { clientId: oThis.clientId }
        })
      );
    }

    let basicHelperResp = basicHelper.transactionDistributionLogic(oThis.fromUserId, workingProcessIds),
      index = basicHelperResp.index,
      workerUuid = basicHelperResp.workerUuid,
      topicName =
        RmqQueueConstants.executeTxTopicPrefix +
        workingProcessIds[index].chain_id +
        '.' +
        workingProcessIds[index].queue_name_suffix;
    // Pass the workerUuid for transfer_bt class.

    const notificationProvider = ic.getNotificationProvider(),
      openStNotification = await notificationProvider.getInstance({
        connectionWaitSeconds: ConnectionTimeoutConst.appServer,
        switchConnectionWaitSeconds: ConnectionTimeoutConst.switchConnectionAppServer
      }),
      payload = {
        transaction_uuid: oThis.transactionUuid,
        client_id: oThis.clientId,
        worker_uuid: workerUuid
      };

    await oThis._createTransactionLog(workerUuid);

    const setToRMQ = await openStNotification.publishEvent
      .perform({
        topics: [topicName], // topicName for distributor queue
        publisher: 'OST',
        message: {
          kind: RmqQueueConstants.executeTx,
          payload: payload
        }
      })
      .catch(async function(err) {
        await oThis._markFailedInTransactionMeta(oThis.transactionUuid);
        logger.error('Message for execute transaction was not published. Payload: ', payload, ' Error: ', err);
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 's_t_e_31',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      });

    //if could not set to RMQ run in async.
    if (setToRMQ.isFailure() || setToRMQ.data.publishedToRmq == 0) {
      await oThis._markFailedInTransactionMeta(oThis.transactionUuid);
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

  _markFailedInTransactionMeta: async function(transactionUuid) {
    const oThis = this;

    if (!transactionUuid) {
      logger.error('transactionUuid was not passed');
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_t_e_32',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }
    await new TransactionMetaModel()
      .update({
        next_action_at: null,
        status: transactionMetaConstants.invertedStatuses[transactionMetaConstants.failed]
      })
      .where(['transaction_uuid = ?', transactionUuid])
      .fire();
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
