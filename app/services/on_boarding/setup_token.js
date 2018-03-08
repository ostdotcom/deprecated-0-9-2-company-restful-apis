"use strict";

/**
 * Setup Token
 *
 * @module app/services/on_boarding/setup_token
 *
 */

const uuid = require('uuid')
;

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , GenerateEthAddressKlass = require(rootPrefix + '/app/services/address/generate')
  , kmsWrapper = require(rootPrefix + '/lib/authentication/kms_wrapper')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , clientBrandedToken = new ClientBrandedTokenKlass()
  , ManagedAddressSaltKlass = require(rootPrefix + '/app/models/managed_address_salt')
  , managedAddressSaltObj = new ManagedAddressSaltKlass()
  , ManagedAddressModelKlass = require(rootPrefix + '/app/models/managed_address')
  , ClientBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , ClientSecuredBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
;

/**
 * Setup token constructor
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom setup is to be made.
 * @param {number} params.symbol - unique(across system) symbol.
 * @param {String} params.name - unique(across system) name of branded token.
 * @param {String} params.symbol_icon - ICON for branded token.
 *
 */
const SetupToken = function (params) {

  var oThis = this;

  oThis.clientId = params.client_id;
  oThis.symbol = params.symbol;
  oThis.name = params.name;
  oThis.symbol_icon = params.symbol_icon;

  oThis.existingToken = null;

  oThis.reserveAddrUuid = null;
  oThis.workerAddrUuid = null;
  oThis.airdropHolderAddrUuid = null;

};

SetupToken.prototype = {

  /**
   * Perform<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  perform: async function () {

    const oThis = this;

    var r = null;

    r = await oThis.validateParams();
    if (r.isFailure()) return r;

    // create managed_address_salts if not present
    r = await oThis.setClientAddressSalt();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.getSetClientAddresses();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.createClientToken();
    if (r.isFailure()) return Promise.resolve(r);

    oThis.clearCache();

    return oThis.renderResponse();

  },

  /**
   * Validate parameters.
   *
   * @return {promise<result>}
   *
   */
  validateParams: async function () {
    // validate if same symbol is already not present.
    const oThis = this
      , tokenBySymbol = await clientBrandedToken.getBySymbol(oThis.symbol);

    if (tokenBySymbol.length > 0) {
      return Promise.resolve(responseHelper.error('s_ob_1', 'Symbol is already present', '', {'symbol': 'Symbol is already present'}))
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Get and set client infor salt. Save in db for future purpose
   *
   * @set saltPlainText
   * @return {promise<result>}
   *
   */
  setClientAddressSalt: async function () {
    var oThis = this;
    const newKey = await kmsWrapper.generateDataKey();

    const addressSalt = newKey["CiphertextBlob"];

    try {
      await managedAddressSaltObj.create({
        client_id: oThis.clientId,
        managed_address_salt: addressSalt
      });
    } catch (err) {
      logger.notify('ob_st_1', 'Something Went Wrong', err);
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  getExistingManagedAddress: async function () {
    var oThis = this
      , clientTokenByClientId = await clientBrandedToken.getByClientId(oThis.clientId);
    if (clientTokenByClientId.length > 0) {
      oThis.existingToken = clientTokenByClientId[clientTokenByClientId.length - 1];
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Get and set client reserve address. Generate new address if already not found.
   *
   * @set reserve_managed_address_id
   * @return {promise<result>}
   *
   */
  getSetClientAddresses: async function () {
    var oThis = this
      , promisesArray = [];

    promisesArray.push(oThis.setClientReserveAddress());
    promisesArray.push(oThis.setClientWorkerAddress());
    promisesArray.push(oThis.setClientAirdropHolderAddress());

    await Promise.all(promisesArray);

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Get and set client reserve address. Generate new address if already not found.
   *
   * @set reserve_managed_address_id, reserveAddrUuid
   * @return {promise<result>}
   *
   */
  setClientReserveAddress: function () {
    var oThis = this
      , managedAddressModelObj = new ManagedAddressModelKlass();

    return new Promise(async function (onResolve, onReject) {

      if (oThis.existingToken && oThis.existingToken.reserve_managed_address_id) {

        oThis.reserve_managed_address_id = oThis.existingToken.reserve_managed_address_id;
        const manageAddrObj = await managedAddressModelObj.getByIds([oThis.reserve_managed_address_id]);
        oThis.reserveAddrUuid = manageAddrObj[0].uuid;
        return onResolve(responseHelper.successWithData({}));

      } else {

        const generateEthAddress = new GenerateEthAddressKlass({
          addressType: managedAddressConst.reserveAddressType,
          clientId: oThis.clientId
        });
        var r = await generateEthAddress.perform();
        if (r.isFailure()) return onResolve(r);
        const resultData = r.data[r.data.result_type][0];
        oThis.reserve_managed_address_id = resultData.id;
        oThis.reserveAddrUuid = resultData.uuid;

        return onResolve(responseHelper.successWithData({}));
      }

    });

  },

  /**
   * Get and set client reserve address. Generate new address if already not found.
   *
   * @set worker_managed_address_id, workerAddrUuid
   * @return {promise<result>}
   *
   */
  setClientWorkerAddress: function () {
    var oThis = this
      , managedAddressModelObj = new ManagedAddressModelKlass();

    return new Promise(async function (onResolve, onReject) {
      if (oThis.existingToken && oThis.existingToken.worker_managed_address_id) {
        oThis.worker_managed_address_id = oThis.existingToken.worker_managed_address_id;
        const manageAddrObj = await managedAddressModelObj.getByIds([oThis.worker_managed_address_id]);
        oThis.workerAddrUuid = manageAddrObj[0].uuid;
        return onResolve(responseHelper.successWithData({}));
      } else {
        var r = await generateEthAddress.perform(oThis.clientId, managedAddressesConst.workerAddressType);
        if (r.isFailure()) return onResolve(r);
        const resultData = r.data[r.data.result_type][0];
        oThis.worker_managed_address_id = resultData.id;
        oThis.workerAddrUuid = resultData.uuid;

        return onResolve(responseHelper.successWithData({}));
      }

    });

  },

  /**
   * Get and set client reserve address. Generate new address if already not found.
   *
   * @set airdrop_holder_managed_address_id, airdropHolderAddrUuid
   * @return {promise<result>}
   *
   */
  setClientAirdropHolderAddress: function () {
    var oThis = this
      , managedAddressModelObj = new ManagedAddressModelKlass();

    return new Promise(async function (onResolve, onReject) {

      if (oThis.existingToken && oThis.existingToken.airdrop_holder_managed_address_id) {
        oThis.airdrop_holder_managed_address_id = oThis.existingToken.airdrop_holder_managed_address_id;
        const manageAddrObj = await managedAddressModelObj.getByIds([oThis.airdrop_holder_managed_address_id]);
        oThis.airdropHolderAddrUuid = manageAddrObj[0].uuid;
        return onResolve(responseHelper.successWithData({}));
      } else {
        var r = await generateEthAddress.perform(oThis.clientId, managedAddressesConst.airdropHolderAddressType);
        if (r.isFailure()) return onResolve(r);
        const resultData = r.data[r.data.result_type][0];
        oThis.airdrop_holder_managed_address_id = resultData.id;
        oThis.airdropHolderAddrUuid = resultData.uuid;

        return onResolve(responseHelper.successWithData({}));
      }

    });

  },

  /**
   * Create new branded token for a client.
   *
   * @set clientTokenObj
   * @return {promise<result>}
   *
   */
  createClientToken: async function () {

    var oThis = this;

    oThis.clientTokenObj = {
      client_id: oThis.clientId,
      symbol: oThis.symbol,
      symbol_icon: oThis.symbol_icon,
      reserve_managed_address_id: oThis.reserve_managed_address_id,
      worker_managed_address_id: oThis.worker_managed_address_id,
      airdrop_holder_managed_address_id: oThis.airdrop_holder_managed_address_id,
      name: oThis.name
    };

    // create entry in client token
    var result = await clientBrandedToken.create(oThis.clientTokenObj);

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

    const clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({'clientId': oThis.clientId});
    clientBrandedTokenCache.clear();

    const clientSecureBrandedTokenCache = new ClientSecuredBrandedTokenCacheKlass({'tokenSymbol': oThis.symbol});
    clientSecureBrandedTokenCache.clear();

  },

  /**
   * return render response.
   * @return {promise<result>}
   */
  renderResponse: function () {
    const oThis = this;
    return Promise.resolve(responseHelper.successWithData(
      {
        id: oThis.reserve_managed_address_id,
        reserveUuid: oThis.reserveAddrUuid,
        workerAddrUuid: oThis.workerAddrUuid,
        airdropHolderAddrUuid: oThis.airdropHolderAddrUuid,
        name: oThis.name,
        client_id: oThis.clientId
      }
    ));
  }

};

module.exports = SetupToken;