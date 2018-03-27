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
  , kmsWrapperKlass = require(rootPrefix + '/lib/authentication/kms_wrapper')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , clientBrandedToken = new ClientBrandedTokenKlass()
  , ClientWorkerManagedAddressIdsKlass = require(rootPrefix + '/app/models/client_worker_managed_address_id')
  , clientWorkerAddrObj = new ClientWorkerManagedAddressIdsKlass()
  , clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id')
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
  oThis.existingWorkerManagedAddressIds = [];

  oThis.reserveAddrUuid = null;
  oThis.airdropHolderAddrUuid = null;
  oThis.workerAddrUuids = [];
  oThis.newWorkerManagedAddressIds = [];

  oThis.allowedWorkersCnt = 5; // check max supported in contract and populate this

};

SetupToken.prototype = {

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch((error) => {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("ob_st_2", "Unhandled result", null, {}, {});
        }
      })
  },

  /**
   * Perform<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  asyncPerform: async function () {

    const oThis = this;

    var r = null;

    r = await oThis.validateParams();
    if (r.isFailure()) return r;

    // create managed_address_salts if not present
    r = await oThis.setClientAddressSalt();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.getExistingManagedAddress();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.setClientAddresses();
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

    var KMSObject = new kmsWrapperKlass('managedAddresses');
    const newKey = await KMSObject.generateDataKey();

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
      , clientTokenByClientId = await clientBrandedToken.getByClientId(oThis.clientId)
      , existingWorkerManagedAddresses = await clientWorkerAddrObj.getByClientId(oThis.clientId);

    if (clientTokenByClientId.length > 0) {
      oThis.existingToken = clientTokenByClientId[clientTokenByClientId.length - 1];
    }

    for(var i=0; i<existingWorkerManagedAddresses.length; i++) {
      oThis.existingWorkerManagedAddressIds.push(existingWorkerManagedAddresses[i].managed_address_id)
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
  setClientAddresses: async function () {
    var oThis = this
      , promisesArray = [];

    promisesArray.push(oThis.setClientReserveAddress());
    promisesArray.push(oThis.setClientWorkerAddresses());
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
          addressType: managedAddressesConst.reserveAddressType,
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
   * @set workerAddrUuids
   * @return {promise<result>}
   *
   */
  setClientWorkerAddresses: function () {

    var oThis = this
      , managedAddressModelObj = new ManagedAddressModelKlass();

    return new Promise(async function (onResolve, onReject) {

      if (oThis.existingWorkerManagedAddressIds.length > 0) {

        const manageAddrObj = await managedAddressModelObj.getByIds(oThis.existingWorkerManagedAddressIds);
        for(var i=0; i<manageAddrObj.length; i++) {
          oThis.workerAddrUuids.push(manageAddrObj[i].uuid);
        }

        return onResolve(responseHelper.successWithData({}));

      } else {

        for(var i=0; i<oThis.allowedWorkersCnt; i++) {
          var generateEthAddress = new GenerateEthAddressKlass({
            addressType: managedAddressesConst.workerAddressType,
            clientId: oThis.clientId
          });
          var r = await generateEthAddress.perform();
          if (r.isFailure()) return onResolve(r);
          const resultData = r.data[r.data.result_type][0];
          oThis.workerAddrUuids.push(resultData.uuid);
          oThis.newWorkerManagedAddressIds.push(resultData.id);
        }

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
        const generateEthAddress = new GenerateEthAddressKlass({
            addressType: managedAddressesConst.airdropHolderAddressType,
            clientId: oThis.clientId
        });
        var r = await generateEthAddress.perform();
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
      airdrop_holder_managed_address_id: oThis.airdrop_holder_managed_address_id,
      name: oThis.name
    };

    // create entry in client token
    var result = await clientBrandedToken.create(oThis.clientTokenObj);

    var managedAddressInsertData = []
        , newWorkerManagedAddressIdsLength = oThis.newWorkerManagedAddressIds.length;

    if (newWorkerManagedAddressIdsLength > 0) {
      for (var i = 0; i < newWorkerManagedAddressIdsLength; i++) {
        managedAddressInsertData.push([oThis.clientId, oThis.newWorkerManagedAddressIds[i],
          clientWorkerAddrObj.invertedStatuses[clientWorkerManagedAddressConst.inactiveStatus]]);
      }
      var fields = ['client_id', 'managed_address_id', 'status'];
      const queryResponse = await clientWorkerAddrObj.bulkInsert(fields, managedAddressInsertData);
    }

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
        workerAddrUuids: oThis.workerAddrUuids,
        airdropHolderAddrUuid: oThis.airdropHolderAddrUuid,
        name: oThis.name,
        client_id: oThis.clientId
      }
    ));
  }

};

module.exports = SetupToken;