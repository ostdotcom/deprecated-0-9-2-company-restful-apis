'use strict';

const rootPrefix = '../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  AirdropRouterKlass = require(rootPrefix + '/lib/allocate_airdrop/router'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  commonValidator = require(rootPrefix + '/lib/validators/common'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/lib/cache_multi_management/managedAddresses');
require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure');

/**
 * Add new transaction kind constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id
 * @param {number} params.token_symbol - token symbol
 * @param {number} params.client_token_id - client_token_id for airdrop
 * @param {Boolean} [params.airdropped] - true: already airdropped, false: never airdropped
 * @param {object} params.amount - airdrop amount
 * @param {string} [params.user_ids] - specific set of users can get shortlisted for airdrop.
 *
 * @constructor
 *
 */
const StartAirdropForKitKlass = function(params) {
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.tokenSymbol = params.token_symbol;
  oThis.airdropAmount = params.amount;
  oThis.airdropped = params.airdropped;
  oThis.userIds = params.user_ids;

  oThis.airdropUserListType = null;

  oThis.clientTokenId = params.client_token_id;

  oThis.clientBrandedToken = null;
};

StartAirdropForKitKlass.prototype = {
  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error('app/services/airdrop_management/kit_drop.js::perform::catch');
      logger.error(error);
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        return responseHelper.error({
          internal_error_identifier: 's_am_kd_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    await oThis.validateAndSanitize();

    await oThis.validateUserIds();

    await oThis.validateReserveBalance();

    return new AirdropRouterKlass({
      current_step: 'init',
      utility_chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
      token_symbol: oThis.tokenSymbol,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      airdrop_params: {
        airdrop_amount: oThis.airdropAmount,
        airdrop_user_list_type: oThis.airdropUserListType,
        user_ids: oThis.userIds
      }
    }).perform();
  },

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  validateAndSanitize: async function() {
    const oThis = this,
      BTSecureCacheKlass = oThis.ic().getClientBrandedTokenSecureCache();

    if (!oThis.clientId || !oThis.tokenSymbol) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_am_kd_2',
          api_error_identifier: 'invalid_api_params',
          debug_options: {}
        })
      );
    }

    if (isNaN(oThis.airdropAmount) || oThis.airdropAmount <= 0) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_am_kd_3',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_airdrop_amount'],
          debug_options: {}
        })
      );
    }

    if (commonValidator.isVarNull(oThis.airdropped)) {
      oThis.airdropUserListType = clientAirdropConst.allAddressesAirdropListType;
    } else {
      if (commonValidator.isVarTrue(oThis.airdropped)) {
        oThis.airdropUserListType = clientAirdropConst.everAirdroppedAddressesAirdropListType;
      } else if (commonValidator.isVarFalse(oThis.airdropped)) {
        oThis.airdropUserListType = clientAirdropConst.neverAirdroppedAddressesAirdropListType;
      } else {
        return Promise.reject(
          responseHelper.paramValidationError({
            internal_error_identifier: 's_am_s_4',
            api_error_identifier: 'invalid_api_params',
            params_error_identifiers: ['invalid_airdropped_filter'],
            debug_options: {}
          })
        );
      }
    }

    let btSecureCache = new BTSecureCacheKlass({ tokenSymbol: oThis.tokenSymbol });
    const cacheRsp = await btSecureCache.fetch();
    if (cacheRsp.isFailure()) {
      return Promise.reject(cacheRsp);
    }

    if (oThis.clientId !== cacheRsp.data.client_id) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_am_kd_5',
          api_error_identifier: 'unauthorized_for_other_client',
          debug_options: {}
        })
      );
    }

    oThis.clientBrandedToken = cacheRsp.data;

    if (!oThis.clientBrandedToken) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_am_kd_6',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_token_symbol'],
          debug_options: {}
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate whether invalid user id is passed for airdrop.
   *
   * @return {Promise<any>}
   */
  validateUserIds: async function() {
    const oThis = this;

    if (oThis.userIds) {
      let invalidUuids = false;
      const uuidsAddressInfo = await new ManagedAddressModel()
        .select('*')
        .where(['uuid in (?)', oThis.userIds])
        .fire();
      if (uuidsAddressInfo.length < oThis.userIds.length) {
        invalidUuids = true;
      }
      for (let i = 0; i < uuidsAddressInfo.length; i++) {
        if (uuidsAddressInfo[i].client_id !== oThis.clientId) {
          invalidUuids = true;
        }
      }
      if (invalidUuids) {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'l_aa_sa_12',
            api_error_identifier: 'invalid_airdrop_uuids',
            params_error_identifiers: ['invalid_airdrop_uuids'],
            error_config: errorConfig
          })
        );
      }
    }
    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate Reserve balance.
   *
   * @return {promise<result>}
   */
  validateReserveBalance: async function() {
    const oThis = this,
      ManagedAddressesCacheKlass = oThis.ic().getManagedAddressCache();

    let macObj = new ManagedAddressesCacheKlass({ uuids: [oThis.clientBrandedToken.reserve_address_uuid] });
    let addr = await macObj.fetch();
    if (addr.isFailure()) {
      return Promise.reject(addr);
    }

    let reserveAddressObj = addr.data[oThis.clientBrandedToken.reserve_address_uuid];

    let params = { client_id: oThis.clientId };
    if (oThis.airdropUserListType === clientAirdropConst.neverAirdroppedAddressesAirdropListType) {
      params['property_unset_bit_value'] = new ManagedAddressModel().invertedProperties[
        managedAddressesConst.airdropGrantProperty
      ];
    } else if (oThis.airdropUserListType === clientAirdropConst.everAirdroppedAddressesAirdropListType) {
      params['property_set_bit_value'] = new ManagedAddressModel().invertedProperties[
        managedAddressesConst.airdropGrantProperty
      ];
    }
    if (oThis.userIds) {
      params['uuids'] = oThis.userIds;
    }
    let response = await new ManagedAddressModel().getFilteredActiveUsersCount(params);
    if (!response[0] || response[0].total_count === 0) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_am_kd_7',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['no_users_for_airdrop_list_type'],
          debug_options: {}
        })
      );
    }

    const platformProvider = oThis.ic().getPlatformProvider(),
      openSTPlaform = platformProvider.getInstance();

    const obj = new openSTPlaform.services.balance.brandedToken({
      address: reserveAddressObj.ethereum_address,
      erc20_address: oThis.clientBrandedToken.token_erc20_address
    });

    let resp = await obj.perform();
    if (resp.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_am_kd_8',
          api_error_identifier: 'something_went_wrong',
          debug_options: {}
        })
      );
    }

    let amountInWei = basicHelper.convertToWei(oThis.airdropAmount);
    if (amountInWei.mul(response[0].total_count).toNumber() > resp.data.balance) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_am_kd_9',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['insufficient_airdrop_amount'],
          debug_options: {}
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

InstanceComposer.registerShadowableClass(StartAirdropForKitKlass, 'getStartAirdropForKitClass');

module.exports = StartAirdropForKitKlass;
