"use strict";

const rootPrefix = '../../..'
  , openStPlatform = require('@openstfoundation/openst-platform')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , AirdropRouterKlass = require(rootPrefix + '/lib/allocate_airdrop/router')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ManagedAddressesCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , managedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , BTSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
;

/**
 * Add new transaction kind constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id
 * @param {number} params.client_token_id - client token id (optional)
 * @param {number} params.token_symbol - token symbol
 * @param {object} params.list_type -
 * @param {object} params.amount -
 *
 * @constructor
 *
 */
const StartAirdropForKitKlass = function (params) {

  var oThis = this;

  oThis.clientId = params.client_id;
  oThis.tokenSymbol = params.token_symbol;
  oThis.airdropAmount = params.amount;
  oThis.airdropUserListType = params.list_type;

  oThis.clientTokenId = params.client_token_id;

  oThis.clientBrandedToken = null;
};

StartAirdropForKitKlass.prototype = {

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
        .catch(function(error) {
          logger.error('app/services/airdrop_management/kit_drop.js::perform::catch');
          logger.error(error);
          if (responseHelper.isCustomResult(error)){
            return error;
          } else {
            return responseHelper.error("s_am_kd_1", "Unhandled result", null, [], {sendErrorEmail: false});
          }
        })
  },

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function() {

    const oThis = this;

    await oThis.validateAndSanitize();

    await oThis.validateReserveBalance();

    return new AirdropRouterKlass({
      current_step: 'init',
      token_symbol: oThis.tokenSymbol,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      airdrop_params: {
        airdrop_amount: oThis.airdropAmount,
        airdrop_user_list_type: oThis.airdropUserListType
      }
    }).perform();

  },

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  validateAndSanitize: async function() {

    const oThis = this;

    if(!oThis.clientId || !oThis.tokenSymbol){
      return Promise.reject(responseHelper.error('s_am_kd_2', 'Invalid Params', null, [], {sendErrorEmail: false}));
    }

    if (isNaN(oThis.airdropAmount) || oThis.airdropAmount <= 0) {
      return Promise.reject(responseHelper.error("s_am_kd_3", "Invalid amount", "", [{amount: 'Invalid amount'}]
        , {sendErrorEmail: false}));
    }

    if (![clientAirdropConst.allAddressesAirdropListType,
        clientAirdropConst.neverAirdroppedAddressesAirdropListType].includes(oThis.airdropUserListType)) {
      return Promise.reject(responseHelper.error("s_am_kd_4", "Invalid List type to airdrop users", "",
        [{airdrop_list_type: 'Invalid List type to airdrop users'}], {sendErrorEmail: false}));
    }

    var btSecureCache = new BTSecureCacheKlass({tokenSymbol: oThis.tokenSymbol});
    const cacheRsp = await btSecureCache.fetch();
    if (cacheRsp.isFailure()) {
      return Promise.reject(cacheRsp);
    }

    if (oThis.clientId != cacheRsp.data.client_id) {
      return Promise.reject(responseHelper.error("s_am_kd_5", "Invalid Token Symbol", null, [], {sendErrorEmail: false}));
    }

    oThis.clientBrandedToken = cacheRsp.data;

    if (!oThis.clientBrandedToken) {
      return Promise.reject(responseHelper.error("s_am_kd_6", "Invalid Token", null, [], {sendErrorEmail: false}));
    }

    return Promise.resolve(responseHelper.successWithData({}))
  },

  /**
   * Validate Reserve balance.
   *
   * @return {promise<result>}
   */
  validateReserveBalance: async function () {
    const oThis = this;

    var macObj = new ManagedAddressesCacheKlass({'uuids': [oThis.clientBrandedToken.reserve_address_uuid]});
    var addr = await macObj.fetch();
    if (addr.isFailure()) {
      return Promise.reject(addr);
    }

    var reserveAddressObj = addr.data[oThis.clientBrandedToken.reserve_address_uuid];

    var maObj = new managedAddressModel();
    var params = {client_id: oThis.clientId};
    if (oThis.airdropUserListType == clientAirdropConst.neverAirdroppedAddressesAirdropListType) {
      params['property_unset_bit_value'] = maObj.invertedProperties[managedAddressesConst.airdropGrantProperty]
    }
    var response = await maObj.getFilteredActiveUsersCount(params);
    if (!response[0] || response[0].total_count == 0) {
      return Promise.reject(responseHelper.error("s_am_kd_7", "No users found to airdrop for this list type", "",
        [{airdrop_list_type: 'No users found to airdrop for this list type'}], {sendErrorEmail: false}));
    }

    const obj = new openStPlatform.services.balance.brandedToken(
      {'address': reserveAddressObj.ethereum_address, 'erc20_address': oThis.clientBrandedToken.token_erc20_address}
    );

    var resp = await obj.perform();
    if (resp.isFailure()) {
      return Promise.reject(responseHelper.error("s_am_kd_8", "Something went wrong.", null, [], {sendErrorEmail: false}));
    }

    var amountInWei = basicHelper.convertToWei(oThis.airdropAmount);
    if (amountInWei.mul(response[0].total_count).toNumber() > resp.data.balance) {
      return Promise.reject(
        responseHelper.error(
          "s_am_kd_9",
          "Insufficient funds to airdrop users",
          "",
          [{amount: 'Available token amount is insufficient. Please mint more tokens or reduce the amount to complete the process.'}],
          {sendErrorEmail: false}
        )
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }

};

module.exports = StartAirdropForKitKlass;