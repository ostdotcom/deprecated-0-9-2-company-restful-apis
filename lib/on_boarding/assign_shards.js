'use strict';

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.internal);

require(rootPrefix + '/lib/cache_management/client_branded_token');
require(rootPrefix + '/app/models/transaction_log');
require(rootPrefix + '/lib/providers/storage');

/**
 * AssignShards
 * @param params
 * @param {object} params - parameters object
 * @param {Integer} params.client_id - client_id
 * @param {String} params.token_erc20_address - token_erc20_address
 * @constructor
 */
const AssignShards = function(params) {
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.tokenErc20Address = params.token_erc20_address || null;
};

AssignShards.prototype = {
  /**
   * Perform
   *
   * @return {promise}
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
          internal_error_identifier: 'l_ob_as_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * asyncPerform
   *
   * @return {promise}
   */
  asyncPerform: async function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy,
      transactionLogModel = oThis.ic().getTransactionLogModel(),
      storageProvider = oThis.ic().getStorageProvider(),
      openSTStorage = storageProvider.getInstance(),
      TokenBalanceModel = openSTStorage.model.TokenBalance;

    await oThis._validate();

    let transactionTypeAllocateRsp = await new transactionLogModel({
      client_id: oThis.clientId.toString()
    }).allocate();

    if (transactionTypeAllocateRsp.isFailure()) {
      return Promise.reject(transactionTypeAllocateRsp);
    }

    let tokenBalanceAllocateRsp = await new TokenBalanceModel({
      erc20_contract_address: oThis.tokenErc20Address,
      chain_id: configStrategy.OST_UTILITY_CHAIN_ID
    }).allocate();

    if (tokenBalanceAllocateRsp.isFailure()) {
      return Promise.reject(tokenBalanceAllocateRsp);
    }

    return Promise.resolve(responseHelper.successWithData());
  },

  /**
   * validate
   *
   * @return {promise}
   */
  _validate: async function() {
    const oThis = this;

    await oThis._validateClientId();

    await oThis._checkForExistingShards();

    return Promise.resolve({});
  },

  /**
   * validate client id
   *
   * @return {promise}
   */
  _validateClientId: async function() {
    const oThis = this,
      ClientBrandedTokenCacheKlass = oThis.ic().getClientBrandedTokenCache();

    if (!commonValidator.isVarInteger(oThis.clientId)) {
      return Promise.reject(oThis._invalidClientError('l_ob_as_2'));
    }

    if (!oThis.tokenErc20Address) {
      const clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({ clientId: oThis.clientId }),
        clientBrandedTokenResponse = await clientBrandedTokenCache.fetch();

      if (clientBrandedTokenResponse.isFailure()) {
        return Promise.reject(oThis._invalidClientError('l_ob_as_3'));
      }

      oThis.tokenErc20Address = clientBrandedTokenResponse.data.token_erc20_address;

      if (!oThis.tokenErc20Address) {
        return Promise.reject(oThis._invalidClientError('l_ob_as_4'));
      }
    }

    return Promise.resolve({});
  },

  /**
   * check if shards are already allocated
   *
   * @return {promise}
   */
  _checkForExistingShards: async function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy,
      transactionLogModel = oThis.ic().getTransactionLogModel(),
      storageProvider = oThis.ic().getStorageProvider(),
      openSTStorage = storageProvider.getInstance(),
      TokenBalanceModel = openSTStorage.model.TokenBalance;

    let hasAllocatedShardRsp = null;

    hasAllocatedShardRsp = await new transactionLogModel({
      client_id: oThis.clientId
    }).hasAllocatedShard();

    if (hasAllocatedShardRsp.isFailure()) {
      return Promise.reject(hasAllocatedShardRsp);
    }

    if (hasAllocatedShardRsp.data['hasAllocatedShard']) {
      return Promise.reject(oThis._invalidClientError('l_ob_as_5'));
    }

    hasAllocatedShardRsp = await new TokenBalanceModel({
      erc20_contract_address: oThis.tokenErc20Address,
      chain_id: configStrategy.OST_UTILITY_CHAIN_ID
    }).hasAllocatedShard();

    if (hasAllocatedShardRsp.isFailure()) {
      return Promise.reject(hasAllocatedShardRsp);
    }

    if (hasAllocatedShardRsp.data['hasAllocatedShard']) {
      return Promise.reject(oThis._invalidClientError('l_ob_as_6'));
    }

    return Promise.resolve({});
  },

  /**
   * return an error object
   *
   * @return {result}
   */
  _invalidClientError: function(internal_id) {
    return responseHelper.paramValidationError({
      internal_error_identifier: internal_id,
      api_error_identifier: 'invalid_api_params',
      params_error_identifiers: ['invalid_client_id'],
      error_config: errorConfig,
      debug_options: {}
    });
  }
};

InstanceComposer.registerShadowableClass(AssignShards, 'getAssignShardsClass');

module.exports = AssignShards;
