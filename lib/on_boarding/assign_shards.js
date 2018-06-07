'use strict';

const OSTStorage = require('@openstfoundation/openst-storage');

const rootPrefix = '../..'
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , autoscalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
  , ClientBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , commonValidator = require(rootPrefix +  '/lib/validators/common')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.internal)
;

/**
 * AssignShards
 * @param params
 * @param {object} params - parameters object
 * @param {Integer} params.client_id - client_id
 * @param {String} params.token_erc20_address - token_erc20_address
 * @constructor
 */
const AssignShards = function (params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
  oThis.tokenErc20Address = params.token_erc20_address || null;
  oThis.chainId = chainIntConstants.UTILITY_CHAIN_ID;

};

AssignShards.prototype = {

  /**
   * Perform
   *
   * @return {promise}
   */
  perform: function () {
    const oThis = this
    ;

    return oThis.asyncPerform()
      .catch(function (error) {
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
  asyncPerform: async function () {

    const oThis = this
    ;

    await oThis._validate();

    let transactionTypeAllocateRsp = await new OSTStorage.TransactionLogModel({
      client_id: oThis.clientId.toString(),
      ddb_service: ddbServiceObj,
      auto_scaling: autoscalingServiceObj
    }).allocate();

    if (transactionTypeAllocateRsp.isFailure()) { return Promise.reject(transactionTypeAllocateRsp); }

    let tokenBalanceAllocateRsp = await new OSTStorage.TokenBalanceModel({
      erc20_contract_address: oThis.tokenErc20Address,
      chain_id: oThis.chainId,
      ddb_service: ddbServiceObj,
      auto_scaling: autoscalingServiceObj
    }).allocate();

    if (tokenBalanceAllocateRsp.isFailure()) { return Promise.reject(tokenBalanceAllocateRsp); }

    return Promise.resolve(responseHelper.successWithData());

  },

  /**
   * validate
   *
   * @return {promise}
   */
  _validate: async function () {

    const oThis = this
    ;

    await oThis._validateClientId();

    await oThis._checkForExistingShards();

    return Promise.resolve({});

  },

  /**
   * validate client id
   *
   * @return {promise}
   */
  _validateClientId: async function () {

    const oThis = this;

    if (!commonValidator.isVarInteger(oThis.clientId)) {
      return Promise.reject(oThis._invalidClientError('l_ob_as_2'));
    }

    if(!oThis.tokenErc20Address) {
      const clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({clientId: oThis.clientId})
        , clientBrandedTokenResponse = await clientBrandedTokenCache.fetch()
      ;

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
  _checkForExistingShards: async function () {

    const oThis = this;

    let hasAllocatedShardRsp = null;

    hasAllocatedShardRsp = await new OSTStorage.TransactionLogModel({
      client_id: oThis.clientId,
      ddb_service: ddbServiceObj,
      auto_scaling: autoscalingServiceObj
    }).hasAllocatedShard();

    if (hasAllocatedShardRsp.isFailure()) { return Promise.reject(hasAllocatedShardRsp) };

    if (hasAllocatedShardRsp.data['hasAllocatedShard']) {
      return Promise.reject(oThis._invalidClientError('l_ob_as_5'));
    }

    hasAllocatedShardRsp = await new OSTStorage.TokenBalanceModel({
      erc20_contract_address: oThis.tokenErc20Address,
      chain_id: oThis.chainId,
      ddb_service: ddbServiceObj,
      auto_scaling: autoscalingServiceObj
    }).hasAllocatedShard();

    if (hasAllocatedShardRsp.isFailure()) { return Promise.reject(hasAllocatedShardRsp) };

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
  _invalidClientError: function (internal_id) {
    return responseHelper.paramValidationError({
      internal_error_identifier: internal_id,
      api_error_identifier: 'invalid_api_params',
      params_error_identifiers: ['invalid_client_id'],
      error_config: errorConfig,
      debug_options: {}
    })
  }

};

module.exports = AssignShards;