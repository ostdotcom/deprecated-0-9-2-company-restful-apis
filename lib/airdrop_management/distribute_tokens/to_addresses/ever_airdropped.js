"use strict";

/**
 *
 * Start adding airdrop details for never airdropped users <br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/to_addresses/never_airdropped
 *
 */

const rootPrefix = '../../../..'
  , baseKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/to_addresses/base')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
;

/**
 * Start adding airdrop details for never airdropped constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_airdrop_obj - client airdrop obj
 *
 * @constructor
 *
 */
const everAirdroppedKlass = function (params) {

  const oThis = this;

  oThis.clientAirdropObj = params.client_airdrop_obj;
  oThis.client_id = oThis.clientAirdropObj.client_id;
  oThis.uuids = params.uuids;

  // Filter required to fetch appropriate users
  oThis.propertyUnsetBitValue = null;
  oThis.propertySetBitValue = new ManagedAddressModel().invertedProperties[managedAddressesConst.airdropGrantProperty];

};

everAirdroppedKlass.prototype = Object.create(baseKlass.prototype);

const everAirdroppedKlassPrototype = {};

Object.assign(everAirdroppedKlass.prototype, everAirdroppedKlassPrototype);

module.exports = everAirdroppedKlass;