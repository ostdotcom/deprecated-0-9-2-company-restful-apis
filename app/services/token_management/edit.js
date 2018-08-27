'use strict';

const openSTNotification = require('@openstfoundation/openst-notification');

const rootPrefix = '../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/lib/cache_management/client_branded_token');
require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure');

const EditBrandedTokenKlass = function(params) {
  const oThis = this;

  oThis.params = params;
  oThis.client_id = oThis.params.client_id;
  oThis.name = oThis.params.name;
  oThis.symbol = oThis.params.symbol;
  oThis.symbol_icon = oThis.params.symbol_icon;
  oThis.token_erc20_address = oThis.params.token_erc20_address;
  oThis.airdrop_contract_addr = oThis.params.airdrop_contract_addr;
  oThis.token_uuid = oThis.params.token_uuid;
  oThis.conversion_factor = oThis.params.conversion_factor;

  oThis.brandedTokenRecordObject = null;
};

EditBrandedTokenKlass.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 's_tm_e_4',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  asyncPerform: async function() {
    const oThis = this;
    let r = null;

    r = await oThis.validateAndSanitize();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.setSimpleStakeContractAddress();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.publishUpdateEvent();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.editToken();

    oThis.clearCache(); // regardless it failed or not flush cache as it might have changed something

    if (r.isFailure()) return Promise.resolve(r);

    return oThis.returnResponse();
  },

  validateAndSanitize: async function() {
    const oThis = this;

    if (!oThis.client_id || !oThis.symbol || !basicHelper.isBTSymbolValid(oThis.symbol)) {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'tm_e_1',
          api_error_identifier: 'invalid_api_params',
          debug_options: {}
        })
      );
    }

    const clientBrandedTokens = await new ClientBrandedTokenModel().getBySymbol(oThis.symbol);
    if (clientBrandedTokens.length <= 0) {
      return Promise.resolve(
        responseHelper.paramValidationError({
          internal_error_identifier: 'tm_e_2',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_token_symbol'],
          debug_options: {}
        })
      );
    }

    oThis.brandedTokenRecordObject = clientBrandedTokens[0];

    if (oThis.brandedTokenRecordObject.client_id !== oThis.client_id) {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'tm_e_3',
          api_error_identifier: 'unauthorized_for_other_client',
          debug_options: {}
        })
      );
    }

    if (oThis.name && basicHelper.isBTNameValid(oThis.name) && oThis.name !== oThis.brandedTokenRecordObject.name) {
      oThis.brandedTokenRecordObject.name = oThis.name;
    }

    if (oThis.symbol_icon && oThis.symbol_icon !== oThis.brandedTokenRecordObject.symbol_icon) {
      oThis.brandedTokenRecordObject.symbol_icon = oThis.symbol_icon;
    }

    if (
      oThis.token_erc20_address &&
      basicHelper.isAddressValid(oThis.token_erc20_address) &&
      oThis.token_erc20_address !== oThis.brandedTokenRecordObject.token_erc20_address
    ) {
      oThis.brandedTokenRecordObject.token_erc20_address = oThis.token_erc20_address;
    }

    if (
      oThis.airdrop_contract_addr &&
      basicHelper.isAddressValid(oThis.airdrop_contract_addr) &&
      oThis.airdrop_contract_addr !== oThis.brandedTokenRecordObject.airdrop_contract_addr
    ) {
      oThis.brandedTokenRecordObject.airdrop_contract_addr = oThis.airdrop_contract_addr;
    }

    if (
      oThis.token_uuid &&
      basicHelper.isTokenUuidValid(oThis.token_uuid) &&
      oThis.token_uuid !== oThis.brandedTokenRecordObject.token_uuid
    ) {
      oThis.brandedTokenRecordObject.token_uuid = oThis.token_uuid;
    }

    if (
      oThis.conversion_factor &&
      basicHelper.isBTConversionRateValid(oThis.conversion_factor) &&
      oThis.conversion_factor !== oThis.brandedTokenRecordObject.conversion_factor
    ) {
      oThis.brandedTokenRecordObject.conversion_factor = oThis.conversion_factor;
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Get and set client simpleStakeContractAddr.
   *
   * @return {promise<result>}
   *
   */
  setSimpleStakeContractAddress: function() {
    const oThis = this,
      platformProvider = oThis.ic().getPlatformProvider(),
      openSTPlatform = platformProvider.getInstance();

    if (!oThis.brandedTokenRecordObject.token_uuid) {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    const object = new openSTPlatform.services.utils.getBrandedTokenDetails({
      uuid: oThis.brandedTokenRecordObject.token_uuid
    });

    const handleOpenStPlatformSuccess = function(getBTDetailsRsp) {
      if (getBTDetailsRsp.isSuccess()) {
        logger.log(getBTDetailsRsp.data);
        const simpleStakeContractAddr = getBTDetailsRsp.data.simple_stake_contract_address;
        if (simpleStakeContractAddr) {
          oThis.brandedTokenRecordObject.simple_stake_contract_addr = simpleStakeContractAddr;
        }
        return Promise.resolve(responseHelper.successWithData({}));
      } else {
        return Promise.resolve(getBTDetailsRsp);
      }
    };

    return object.perform().then(handleOpenStPlatformSuccess);
  },

  publishUpdateEvent: function() {
    const oThis = this,
      publish_data = {},
      configStrategy = oThis.ic().configStrategy;

    publish_data.name = oThis.brandedTokenRecordObject.name;
    publish_data.ost_to_bt_conversion_factor = oThis.brandedTokenRecordObject.conversion_factor;
    publish_data.symbol_icon = oThis.brandedTokenRecordObject.symbol_icon;
    publish_data.symbol = oThis.brandedTokenRecordObject.symbol;
    publish_data.uuid = oThis.brandedTokenRecordObject.token_uuid;
    publish_data.created_at = new Date(oThis.brandedTokenRecordObject.created_at).getTime() / 1000;
    publish_data.simple_stake_contract_addr = oThis.brandedTokenRecordObject.simple_stake_contract_addr;

    if (Object.keys(publish_data).length === 0 || !oThis.brandedTokenRecordObject.token_erc20_address) {
      return Promise.resolve(responseHelper.successWithData({}));
    }
    openSTNotification.publishEvent.perform({
      topics: ['entity.branded_token'],
      publisher: 'OST',
      message: {
        kind: 'shared_entity',
        payload: {
          entity: 'branded_token',
          identifier: {
            erc20_contract_address: oThis.brandedTokenRecordObject.token_erc20_address,
            chain_id: configStrategy.OST_UTILITY_CHAIN_ID
          },
          operation: 'update',
          data: publish_data
        }
      }
    });
    return Promise.resolve(responseHelper.successWithData({}));
  },

  editToken: async function() {
    const oThis = this;

    await new ClientBrandedTokenModel()
      .update(oThis.brandedTokenRecordObject)
      .where(['id = ?', oThis.brandedTokenRecordObject.id])
      .fire();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * clear cache
   *
   * return render response.
   * @return {promise<result>}
   */
  clearCache: function() {
    const oThis = this,
      ClientBrandedTokenCacheKlass = oThis.ic().getClientBrandedTokenCache(),
      ClientSecuredBrandedTokenCacheKlass = oThis.ic().getClientBrandedTokenSecureCache();
    const clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({ clientId: oThis.client_id });
    clientBrandedTokenCache.clear();

    const clientSecureBrandedTokenCache = new ClientSecuredBrandedTokenCacheKlass({ tokenSymbol: oThis.symbol });
    clientSecureBrandedTokenCache.clear();
  },

  returnResponse: function() {
    return Promise.resolve(responseHelper.successWithData({}));
  }
};

InstanceComposer.registerShadowableClass(EditBrandedTokenKlass, 'getEditBrandedTokenKlass');

module.exports = EditBrandedTokenKlass;
