"use strict";

const openStPlatform = require('@openstfoundation/openst-platform')
  , openSTNotification = require('@openstfoundation/openst-notification')
;

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , ClientBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , ClientSecuredBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

const clientBrandedTokenObj = new ClientBrandedTokenKlass()
;

const EditBrandedTokenKlass = function (params) {

  var oThis = this;

  oThis.params = params;
  oThis.client_id = oThis.params.client_id;
  oThis.name = oThis.params.name;
  oThis.symbol = oThis.params.symbol;
  oThis.symbol_icon = oThis.params.symbol_icon;
  oThis.token_erc20_address = oThis.params.token_erc20_address;
  oThis.airdrop_contract_addr = oThis.params.airdrop_contract_addr;
  oThis.token_uuid = oThis.params.token_uuid;
  oThis.conversion_factor = oThis.params.conversion_factor;

  oThis.brandedTokenAr = null;

};

EditBrandedTokenKlass.prototype = {

  perform: async function () {
    var oThis = this
      , r = null;

    r = await oThis.validateAndSanitize();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.setSimpleStakeContractAddress();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.publishUpdateEvent();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.editToken();

    oThis.clearCache(); // regardless it failed or not flush cache as it might have changed something

    if(r.isFailure()) return Promise.resolve(r);

    return oThis.returnResponse();

  },

  validateAndSanitize: async function () {
    var oThis = this;

    if(!oThis.client_id || !oThis.symbol || !basicHelper.isBTSymbolValid(oThis.symbol)){
      return Promise.resolve(responseHelper.error('tm_e_1', 'Unauthorized access'));
    }

    const clientBrandedTokens = await clientBrandedTokenObj.getBySymbol(oThis.symbol);
    if(clientBrandedTokens.length <= 0){
      return Promise.resolve(responseHelper.error('tm_e_2', 'Invalid Edit request'));
    }

    oThis.brandedTokenAr = clientBrandedTokens[0];

    if(oThis.brandedTokenAr.client_id != oThis.client_id){
      return Promise.resolve(responseHelper.error('tm_e_3', 'Unauthorized access'));
    }

    if(oThis.name && basicHelper.isBTNameValid(oThis.name) && oThis.name != oThis.brandedTokenAr.name){
      oThis.brandedTokenAr.name = oThis.name;
    }

    if(oThis.symbol_icon && oThis.symbol_icon != oThis.brandedTokenAr.symbol_icon){
      oThis.brandedTokenAr.symbol_icon = oThis.symbol_icon;
    }

    if(oThis.token_erc20_address && basicHelper.isAddressValid(oThis.token_erc20_address) &&
      oThis.token_erc20_address != oThis.brandedTokenAr.token_erc20_address
    ){
      oThis.brandedTokenAr.token_erc20_address = oThis.token_erc20_address;
    }

    if(oThis.airdrop_contract_addr && basicHelper.isAddressValid(oThis.airdrop_contract_addr) &&
      oThis.airdrop_contract_addr != oThis.brandedTokenAr.airdrop_contract_addr
    ){
      oThis.brandedTokenAr.airdrop_contract_addr = oThis.airdrop_contract_addr;
    }

    if((oThis.token_uuid && basicHelper.isUuidValid(oThis.token_uuid)) &&
        (oThis.token_uuid != oThis.brandedTokenAr.token_uuid)
    ){
      oThis.brandedTokenAr.token_uuid = oThis.token_uuid;
    }

    if(oThis.conversion_factor && basicHelper.isBTConversionRateValid(oThis.conversion_factor) &&
      oThis.conversion_factor != oThis.brandedTokenAr.conversion_factor
    ){
      oThis.brandedTokenAr.conversion_factor = oThis.conversion_factor;
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Get and set client simpleStakeContractAddr.
   *
   * @return {promise<result>}
   *
   */
  setSimpleStakeContractAddress:  function () {

    const oThis = this;

    if (!oThis.brandedTokenAr.token_uuid) {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    const object = new openStPlatform.services.utils.getBrandedTokenDetails({
      uuid: oThis.brandedTokenAr.token_uuid
    });

    const handleOpenStPlatformSuccess = function (getBTDetailsRsp) {
      if(getBTDetailsRsp.isSuccess()){
        logger.log(getBTDetailsRsp.data);
        const simpleStakeContractAddr = getBTDetailsRsp.data.simple_stake_contract_address;
        if (simpleStakeContractAddr) {
          oThis.brandedTokenAr.simple_stake_contract_addr = simpleStakeContractAddr;
        }
        return Promise.resolve(responseHelper.successWithData({}));
      } else {
        return Promise.resolve(responseHelper.error(getBTDetailsRsp.err.code, getBTDetailsRsp.err.message));
      }
    };

    return object.perform().then(handleOpenStPlatformSuccess);

  },


  publishUpdateEvent: function () {

    var oThis = this
      , publish_data = {};

    publish_data.name = oThis.brandedTokenAr.name;
    publish_data.ost_to_bt_conversion_factor = oThis.brandedTokenAr.conversion_factor;
    publish_data.symbol_icon = oThis.brandedTokenAr.symbol_icon;
    publish_data.symbol = oThis.brandedTokenAr.symbol;
    publish_data.uuid = oThis.brandedTokenAr.token_uuid;
    publish_data.created_at = new Date(oThis.brandedTokenAr.created_at).getTime() / 1000;

    if(Object.keys(publish_data).length == 0 || !oThis.brandedTokenAr.token_erc20_address){
      return Promise.resolve(responseHelper.successWithData({}));
    }
    openSTNotification.publishEvent.perform(
      {
        topics: ['entity.branded_token'],
        publisher: 'OST',
        message: {
          kind: 'shared_entity',
          payload: {
            entity: 'branded_token',
            identifier: {
              erc20_contract_address: oThis.brandedTokenAr.token_erc20_address,
              chain_id: chainIntConstants.UTILITY_CHAIN_ID
            },
            operation: 'update',
            data: publish_data
          }
        }
      }
    );
    return Promise.resolve(responseHelper.successWithData({}));
  },

  editToken: async function () {

    var oThis = this;

    await clientBrandedTokenObj.edit(
      {
        qParams: oThis.brandedTokenAr,
        whereCondition: {
          id: oThis.brandedTokenAr.id
        }
      }
    );

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * clear cache
   *
   * return render response.
   * @return {promise<result>}
   */
  clearCache: function () {

    const oThis = this;

    const clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({'clientId': oThis.client_id});
    clientBrandedTokenCache.clear();

    const clientSecureBrandedTokenCache = new ClientSecuredBrandedTokenCacheKlass({'tokenSymbol': oThis.symbol});
    clientSecureBrandedTokenCache.clear();

  },

  returnResponse: function () {
    return Promise.resolve(responseHelper.successWithData({}));
  }

};

module.exports = EditBrandedTokenKlass;