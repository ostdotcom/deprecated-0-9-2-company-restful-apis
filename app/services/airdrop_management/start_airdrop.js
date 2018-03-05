"use strict";

/**
 * Start Airdrop for client branded token.
 *
 * @module app/services/airdrop_management/start_airdrop
 */

const rootPrefix = '../../..'
  , uuid = require('uuid')
  , openStPlatform = require('@openstfoundation/openst-platform')
  , openSTNotification = require('@openstfoundation/openst-notification')
  , BTSecureCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , BTCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , ManagedAddressesCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientAirdropModel = require(rootPrefix + '/app/models/client_airdrop')
  , managedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , coreConstants = require(rootPrefix + '/config/core_constants')
;

/**
 * Start Airdrop constructor
 *
 * @param params
 * @Constructor
 */
const startAirdropKlass = function (params) {
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.amount = params.amount;
  oThis.listType = params.list_type;
  oThis.clientBrandedToken = null;
  oThis.airdropUuid = null;
  oThis.tokenSymbol = null;
};

startAirdropKlass.prototype = {

  /**
   * Perform
   *
   * @return {Promise<result>}
   */
  perform: async function () {
    const oThis = this;

    var r1 = await oThis.validateInput();
    if (r1.isFailure()) {
      return Promise.resolve(r1);
    }

    var r2 = await oThis.validateIncompleteRequests();
    if (r2.isFailure()) {
      return Promise.resolve(r2);
    }

    var r3 = await oThis.validateReserveBalance();
    if (r3.isFailure()) {
      return Promise.resolve(r3);
    }

    oThis.insertDb();

    return Promise.resolve(responseHelper.successWithData({airdrop_uuid: oThis.airdropUuid}))
  },

  /**
   * Validate Input parameters
   *
   * Sets clientBrandedToken
   * @return {Promise<any>}
   */
  validateInput: async function () {
    const oThis = this;

    if (isNaN(oThis.amount) || oThis.amount < 0) {
      return Promise.resolve(responseHelper.error("s_am_sa_1", "Invalid amount", "", [{amount: 'Invalid amount'}]));
    }

    if (![clientAirdropConst.allAddressesAirdropListType,
        clientAirdropConst.neverAirdroppedAddressesAirdropListType].includes(oThis.listType)) {
      return Promise.resolve(responseHelper.error("s_am_sa_2", "Invalid List type to airdrop users", "", [{airdrop_list_type: 'Invalid List type to airdrop users'}]));
    }

    const btCache = new BTCacheKlass({clientId: oThis.clientId})
      , btCacheRsp = await btCache.fetch();

    if (btCacheRsp.isFailure()) {
      return Promise.resolve(cacheRsp);
    }
    oThis.tokenSymbol = btCacheRsp.data.symbol;

    if (!oThis.tokenSymbol) {
      return Promise.resolve(responseHelper.error("s_am_sa_3", "Invalid Token Symbol"));
    }

    var btSecureCache = new BTSecureCacheKlass({tokenSymbol: oThis.tokenSymbol});
    const cacheRsp = await btSecureCache.fetch();
    if (cacheRsp.isFailure()) {
      return Promise.resolve(cacheRsp);
    }

    if (oThis.clientId != cacheRsp.data.client_id) {
      return Promise.resolve(responseHelper.error("s_am_sa_3", "Invalid Token Symbol"));
    }

    oThis.clientBrandedToken = cacheRsp.data;

    return Promise.resolve(responseHelper.successWithData({}))
  },

  /**
   * Validate whether any incomplete requests are in process
   *
   * @return {Promise<any>}
   */
  validateIncompleteRequests: async function () {
    const oThis = this;

    var obj = new clientAirdropModel();
    var clientAirdrops = await obj.getByClientId(oThis.clientId);
    if (clientAirdrops.length > 0) {
      for (var i = 0; i < clientAirdrops.length; i++) {
        if ([clientAirdropConst.incompleteStatus, clientAirdropConst.processingStatus].includes(obj.statuses[clientAirdrops[i].status])) {
          return Promise.resolve(responseHelper.error("s_am_sa_4", "Airdrop requests are in-process"));
        }
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Validate Reserve's branded token balance is more than airdrop total.
   *
   * @return {Promise<any>}
   */
  validateReserveBalance: async function () {
    const oThis = this;

    var macObj = new ManagedAddressesCacheKlass({'uuids': [oThis.clientBrandedToken.reserve_address_uuid]});
    var addr = await macObj.fetch();
    if (addr.isFailure()) {
      return Promise.resolve(addr);
    }

    var reserveAddressObj = addr.data[oThis.clientBrandedToken.reserve_address_uuid];

    const obj = new openStPlatform.services.balance.brandedToken(
      {'address': reserveAddressObj.ethereum_address, 'erc20_address': oThis.clientBrandedToken.token_erc20_address}
    );

    var resp = await obj.perform();
    if (resp.isFailure()) {
      return Promise.resolve(responseHelper.error("s_am_sa_5", "Something went wrong."));
    }

    var maObj = new managedAddressModel();
    var params = {client_id: oThis.clientId};
    if (oThis.listType == clientAirdropConst.neverAirdroppedAddressesAirdropListType) {
      params['property_unset_bit_value'] = maObj.invertedProperties[managedAddressesConst.airdropGrantProperty]
    }
    var response = await maObj.getFilteredActiveUsersCount(params);
    if (!response[0] || response[0].total_count == 0) {
      return Promise.resolve(responseHelper.error("s_am_sa_6", "No users found to airdrop for this list type", "", [{airdrop_list_type: 'No users found to airdrop for this list type'}]));
    }

    var amountInWei = basicHelper.convertToWei(oThis.amount);
    var totalAmountToAirdrop = (parseInt(response[0].total_count) * oThis.amount);
    if (amountInWei.mul(response[0].total_count).toNumber() > resp.data.balance) {
      return Promise.resolve(
        responseHelper.error(
          "s_am_sa_7",
          "Insufficient funds to airdrop users",
          "",
          [{amount: 'Available token amount is insufficient. Please mint more tokens or reduce the amount to complete the process.'}],
          {sendErrorEmail: false}
        )
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Insert in Database
   *
   * Sets @airdropUuid
   *
   */
  insertDb: async function () {
    const oThis = this;
    oThis.airdropUuid = uuid.v4();
    var obj = new clientAirdropModel();
    var resp = await obj.create({
      airdrop_uuid: oThis.airdropUuid, client_id: oThis.clientId,
      client_branded_token_id: oThis.clientBrandedToken.id,
      common_airdrop_amount_in_wei: basicHelper.convertToWei(oThis.amount).toNumber(),
      airdrop_list_type: oThis.listType, status: clientAirdropConst.incompleteStatus
    });

    // Publish Airdrop event
    openSTNotification.publishEvent.perform(
      {
        topics: ['airdrop.start.'+ coreConstants.PACKAGE_NAME],
        publisher: 'OST',
        message: {
          kind: 'background_job',
          payload: {
            client_airdrop_id: resp.insertId
          }
        }
      }
    );
  }

};

module.exports = startAirdropKlass;