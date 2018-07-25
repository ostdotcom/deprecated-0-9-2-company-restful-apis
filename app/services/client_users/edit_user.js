'use strict';

/**
 * Edit Name of a user
 *
 * @module services/client_users/edit_user
 */
const rootPrefix = '../../..',
  EconomyUserBalanceKlass = require(rootPrefix + '/lib/economy_user_balance'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  UserEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/user'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

/**
 * Update user klass
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom users are to be updated.
 * @param {number} params.id - identifier of this user
 * @param {number} params.name - name to be given to this user
 *
 */
const EditUserKlass = function(params) {
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.userUuid = params.id;
  oThis.name = params.name;
};

EditUserKlass.prototype = {
  /**
   *
   * Perform
   *
   * @return {Promise<result>}
   *
   */
  perform: function() {
    const oThis = this;

    return oThis.asycnPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 's_cu_eu_4',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * Perform Edit user operation
   *
   * @return {Promise<result>}
   *
   */
  asycnPerform: async function() {
    const oThis = this,
      clientId = oThis.clientId,
      userUuid = oThis.userUuid,
      errors_object = [];

    var name = oThis.name;

    if (!basicHelper.isUuidValid(userUuid)) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_cu_eu_1',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_id_user'],
          debug_options: {}
        })
      );
    }

    if (name) {
      name = name.trim();
    }

    if (!basicHelper.isUserNameValid(name)) {
      errors_object.push('invalid_username');
    } else if (basicHelper.hasStopWords(name)) {
      errors_object.push('inappropriate_username');
    }

    if (errors_object.length > 0) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_cu_eu_2',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: errors_object,
          debug_options: {}
        })
      );
    }

    var managedAddressCache = new ManagedAddressCacheKlass({ uuids: [userUuid] });

    const cacheFetchResponse = await managedAddressCache.fetch();

    if (cacheFetchResponse.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_cu_eu_2',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    const response = cacheFetchResponse.data[userUuid];

    if (!response) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_cu_eu_2.1',
          api_error_identifier: 'resource_not_found',
          debug_options: {}
        })
      );
    }

    if (response['client_id'] != clientId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_cu_eu_3',
          api_error_identifier: 'unauthorized_for_other_client',
          debug_options: {}
        })
      );
    }

    const ethereumAddress = response['ethereum_address'],
      economyUserBalance = new EconomyUserBalanceKlass({ client_id: clientId, ethereum_addresses: [ethereumAddress] }),
      userBalance = await economyUserBalance.perform();

    var totalAirdroppedTokens = 0,
      tokenBalance = 0;

    if (!userBalance.isFailure()) {
      const userBalanceData = userBalance.data[ethereumAddress];

      totalAirdroppedTokens = userBalanceData['totalAirdroppedTokens'];
      tokenBalance = userBalanceData['tokenBalance'];
    }

    const userEntityData = {
      uuid: userUuid,
      name: name,
      address: ethereumAddress,
      total_airdropped_tokens: basicHelper.convertToNormal(totalAirdroppedTokens).toString(10),
      token_balance: basicHelper.convertToNormal(tokenBalance).toString(10)
    };

    const userEntityFormatter = new UserEntityFormatterKlass(userEntityData),
      userEntityFormatterRsp = await userEntityFormatter.perform();

    const apiResponseData = {
      result_type: 'user',
      user: userEntityFormatterRsp.data
    };

    if (response['name'] === name) {
      return Promise.resolve(responseHelper.successWithData(apiResponseData));
    }

    new ManagedAddressModel()
      .update({ name: name })
      .where({ uuid: userUuid })
      .fire();

    managedAddressCache.clear();

    return Promise.resolve(responseHelper.successWithData(apiResponseData));
  }
};

module.exports = EditUserKlass;
