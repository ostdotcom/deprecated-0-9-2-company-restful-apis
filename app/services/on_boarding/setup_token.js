"use strict";

/**
 * Setup Token with following steps
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
;

/**
 * Setup token constructor
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom setup is to be made.
 * @param {number} params.symbol - unique(across system) symbol.
 *
 */
const SetupToken = function(params){

  this.clientId = params.client_id;
  this.symbol = params.symbol;

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

    oThis.addrUuid = uuid.v4();

    var r = null;

    r = await oThis.validateParams();
    if(r.isFailure()) return r;

    // create managed_address_salts if not present
    r = await oThis.setClientAddressSalt();
    if(r.isFailure()) return r;

    r = await oThis.setClientReserveAddress();
    if(r.isFailure()) return r;

    r = await oThis.createClientToken();
    if(r.isFailure()) return r;

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
    oThis.saltPlainText = newKey["Plaintext"];

    try {
      await managedAddressSaltObj.create({
        client_id: oThis.clientId,
        managed_address_salt: addressSalt
      });
    } catch(err){
      //console.log("eeeerrrrooooorrr-------", err);
      oThis.saltPlainText = null;
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
    } else {
      var r = await generateEthAddress.perform(oThis.clientId, oThis.addrUuid, oThis.saltPlainText);
      if(r.isFailure()) return Promise.resolve(r);
      oThis.reserve_managed_address_id = r.data.id;
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
      reserve_managed_address_id: oThis.reserve_managed_address_id
    };

    // create entry in client token
    var result = await clientBrandedToken.create(oThis.clientTokenObj);

    return Promise.resolve(responseHelper.successWithData({}));
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
        reserveUuid: oThis.addrUuid
        name: oThis.name,
        client_id: oThis.clientId
      }
    ));
  }

};

module.exports = SetupToken;