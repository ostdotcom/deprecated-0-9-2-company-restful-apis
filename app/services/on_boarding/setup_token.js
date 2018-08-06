'use strict';

/**
 * Setup Token
 *
 * @module app/services/on_boarding/setup_token
 *
 */

const uuid = require('uuid');

const rootPrefix = '../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  kmsWrapperKlass = require(rootPrefix + '/lib/authentication/kms_wrapper'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id'),
  ManagedAddressSaltModel = require(rootPrefix + '/app/models/managed_address_salt'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/app/services/address/generate');
require(rootPrefix + '/lib/cache_management/client_branded_token');
require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure');

/**
 * Setup token constructor
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom setup is to be made.
 * @param {String} params.symbol - unique(across system) symbol.
 * @param {String} params.name - unique(across system) name of branded token.
 * @param {String} params.symbol_icon - ICON for branded token.
 *
 */
const SetupToken = function(params) {
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
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'ob_st_2',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * Perform<br><br>
   *
   * @return {promise<result>} - returns a promise which resolves to an object of Result
   *
   */
  asyncPerform: async function() {
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
  validateParams: async function() {
    // validate if same symbol is already not present.
    const oThis = this,
      tokenBySymbol = await new ClientBrandedTokenModel().getBySymbol(oThis.symbol);

    if (tokenBySymbol.length > 0) {
      return Promise.resolve(
        responseHelper.paramValidationError({
          internal_error_identifier: 's_ob_1',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['token_symbol_already_exists'],
          debug_options: {}
        })
      );
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
  setClientAddressSalt: async function() {
    var oThis = this;

    var KMSObject = new kmsWrapperKlass('managedAddresses');
    const newKey = await KMSObject.generateDataKey();

    const addressSalt = newKey['CiphertextBlob'];

    await new ManagedAddressSaltModel().insert({ client_id: oThis.clientId, managed_address_salt: addressSalt }).fire();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  getExistingManagedAddress: async function() {
    var oThis = this,
      clientTokenByClientId = await new ClientBrandedTokenModel().getByClientId(oThis.clientId),
      existingWorkerManagedAddresses = await new ClientWorkerManagedAddressIdModel().getByClientId(oThis.clientId);

    if (clientTokenByClientId.length > 0) {
      oThis.existingToken = clientTokenByClientId[clientTokenByClientId.length - 1];
    }

    for (var i = 0; i < existingWorkerManagedAddresses.length; i++) {
      oThis.existingWorkerManagedAddressIds.push(existingWorkerManagedAddresses[i].managed_address_id);
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
  setClientAddresses: async function() {
    var oThis = this,
      promisesArray = [];

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
  setClientReserveAddress: function() {
    const oThis = this,
      GenerateEthAddressKlass = oThis.ic().getGenerateAddressClass();

    return new Promise(async function(onResolve, onReject) {
      if (oThis.existingToken && oThis.existingToken.reserve_managed_address_id) {
        oThis.reserve_managed_address_id = oThis.existingToken.reserve_managed_address_id;
        const manageAddrObj = await new ManagedAddressModel().getByIds([oThis.reserve_managed_address_id]);
        oThis.reserveAddrUuid = manageAddrObj[0].uuid;
        return onResolve(responseHelper.successWithData({}));
      } else {
        const generateEthAddress = new GenerateEthAddressKlass({
          address_type: managedAddressesConst.reserveAddressType,
          client_id: oThis.clientId
        });
        var r = await generateEthAddress.perform();
        if (r.isFailure()) return onResolve(r);
        const resultData = r.data[r.data.result_type];
        oThis.reserveAddrUuid = resultData.id;
        const manageAddrObj = await new ManagedAddressModel().getByUuids([oThis.reserveAddrUuid]);
        oThis.reserve_managed_address_id = manageAddrObj[0].id;

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
  setClientWorkerAddresses: function() {
    const oThis = this,
      GenerateEthAddressKlass = oThis.ic().getGenerateAddressClass();

    return new Promise(async function(onResolve, onReject) {
      if (oThis.existingWorkerManagedAddressIds.length > 0) {
        const manageAddrObj = await new ManagedAddressModel().getByIds(oThis.existingWorkerManagedAddressIds);
        for (var i = 0; i < manageAddrObj.length; i++) {
          oThis.workerAddrUuids.push(manageAddrObj[i].uuid);
        }

        return onResolve(responseHelper.successWithData({}));
      } else {
        for (var i = 0; i < oThis.allowedWorkersCnt; i++) {
          var generateEthAddress = new GenerateEthAddressKlass({
            address_type: managedAddressesConst.workerAddressType,
            client_id: oThis.clientId
          });
          var r = await generateEthAddress.perform();
          if (r.isFailure()) return onResolve(r);
          const resultData = r.data[r.data.result_type];
          oThis.workerAddrUuids.push(resultData.id);
        }

        const manageAddrObjs = await new ManagedAddressModel().getByUuids(oThis.workerAddrUuids);
        for (var i = 0; i < manageAddrObjs.length; i++) {
          oThis.newWorkerManagedAddressIds.push(manageAddrObjs[i].id);
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
  setClientAirdropHolderAddress: function() {
    const oThis = this,
      GenerateEthAddressKlass = oThis.ic().getGenerateAddressClass();

    return new Promise(async function(onResolve, onReject) {
      if (oThis.existingToken && oThis.existingToken.airdrop_holder_managed_address_id) {
        oThis.airdrop_holder_managed_address_id = oThis.existingToken.airdrop_holder_managed_address_id;
        const manageAddrObj = await new ManagedAddressModel().getByIds([oThis.airdrop_holder_managed_address_id]);
        oThis.airdropHolderAddrUuid = manageAddrObj[0].uuid;
        return onResolve(responseHelper.successWithData({}));
      } else {
        const generateEthAddress = new GenerateEthAddressKlass({
          address_type: managedAddressesConst.airdropHolderAddressType,
          client_id: oThis.clientId
        });
        var r = await generateEthAddress.perform();
        if (r.isFailure()) return onResolve(r);
        const resultData = r.data[r.data.result_type];
        oThis.airdropHolderAddrUuid = resultData.id;
        const manageAddrObj = await new ManagedAddressModel().getByUuids([oThis.airdropHolderAddrUuid]);
        oThis.airdrop_holder_managed_address_id = manageAddrObj[0].id;

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
  createClientToken: async function() {
    const oThis = this;

    oThis.clientTokenObj = {
      client_id: oThis.clientId,
      symbol: oThis.symbol,
      symbol_icon: oThis.symbol_icon,
      reserve_managed_address_id: oThis.reserve_managed_address_id,
      airdrop_holder_managed_address_id: oThis.airdrop_holder_managed_address_id,
      name: oThis.name
    };

    // create entry in client token
    await new ClientBrandedTokenModel().insert(oThis.clientTokenObj).fire();

    var managedAddressInsertData = [],
      newWorkerManagedAddressIdsLength = oThis.newWorkerManagedAddressIds.length;

    if (newWorkerManagedAddressIdsLength > 0) {
      for (var i = 0; i < newWorkerManagedAddressIdsLength; i++) {
        managedAddressInsertData.push([
          oThis.clientId,
          oThis.newWorkerManagedAddressIds[i],
          new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.inactiveStatus]
        ]);
      }
      var fields = ['client_id', 'managed_address_id', 'status'];
      const queryResponse = await new ClientWorkerManagedAddressIdModel()
        .insertMultiple(fields, managedAddressInsertData)
        .fire();
    }

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

    const clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({ clientId: oThis.clientId });
    clientBrandedTokenCache.clear();

    const clientSecureBrandedTokenCache = new ClientSecuredBrandedTokenCacheKlass({ tokenSymbol: oThis.symbol });
    clientSecureBrandedTokenCache.clear();
  },

  /**
   * return render response.
   * @return {promise<result>}
   */
  renderResponse: function() {
    const oThis = this;
    return Promise.resolve(
      responseHelper.successWithData({
        id: oThis.reserve_managed_address_id,
        reserveUuid: oThis.reserveAddrUuid,
        workerAddrUuids: oThis.workerAddrUuids,
        airdropHolderAddrUuid: oThis.airdropHolderAddrUuid,
        name: oThis.name,
        client_id: oThis.clientId
      })
    );
  }
};

InstanceComposer.registerShadowableClass(SetupToken, 'getSetupToken');

module.exports = SetupToken;
