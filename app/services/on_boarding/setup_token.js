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
  , generateEthAddress = require(rootPrefix + '/app/services/address/generate')
  , kmsWrapper = require(rootPrefix + '/lib/authentication/kms_wrapper')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , clientBrandedToken = new ClientBrandedTokenKlass()
  , ManagedAddressSaltKlass = require(rootPrefix + '/app/models/managed_address_salt')
  , managedAddressSaltObj = new ManagedAddressSaltKlass()
  , ClientBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
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
const SetupToken = function(params){

  this.clientId = params.client_id;
  this.symbol = params.symbol;
  this.name = params.name;
  this.symbol_icon = params.symbol_icon;

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
    if(r.isFailure()) return r;

    // create managed_address_salts if not present
    r = await oThis.setClientAddressSalt();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.setClientReserveAddress();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.createClientToken();
    if(r.isFailure()) return Promise.resolve(r);

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

    if(tokenBySymbol.length > 0){
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
  setClientAddressSalt: async function(){
    var oThis = this;
    const newKey = await kmsWrapper.generateDataKey();

    const addressSalt = newKey["CiphertextBlob"];

    try {
      await managedAddressSaltObj.create({
        client_id: oThis.clientId,
        managed_address_salt: addressSalt
      });
    } catch(err){
      logger.error(err);
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
  setClientReserveAddress: async function () {
    var oThis = this
      , tokenByClientId = await clientBrandedToken.getByClientId(oThis.clientId);

    if(tokenByClientId.length > 0){
      const existingToken = tokenByClientId[tokenByClientId.length-1];
      oThis.reserve_managed_address_id = existingToken.reserve_managed_address_id;
      // handle setting oThis.addrUuid by querying managed_address table ?
    } else {
      var r = await generateEthAddress.perform(oThis.clientId);
      if(r.isFailure()) return Promise.resolve(r);
      var createdAddress = r.data[r.data.result_type][0];
      oThis.reserve_managed_address_id = createdAddress.id;
      oThis.addrUuid = createdAddress.uuid;
    }

    return Promise.resolve(responseHelper.successWithData({}));

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
    clientBrandedTokenCache.clear()
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
        reserveUuid: oThis.addrUuid,
        name: oThis.name,
        client_id: oThis.clientId
      }
    ));
  }

};

module.exports = SetupToken;