'use strict';

/**
 *
 * Start adding airdrop details for never airdropped users <br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/to_addresses/never_airdropped
 *
 */

const rootPrefix = '../../../..',
  baseKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/to_addresses/base'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * Start adding airdrop details for never airdropped constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_airdrop_obj - client airdrop obj
 *
 * @constructor
 *
 */
const neverAirdroppedKlass = function(params) {
  const oThis = this;

  oThis.clientAirdropObj = params.client_airdrop_obj;
  oThis.client_id = oThis.clientAirdropObj.client_id;
  oThis.uuids = params.uuids;

  // Filter required to fetch appropriate users
  oThis.propertyUnsetBitValue = new ManagedAddressModel().invertedProperties[
    managedAddressesConst.airdropGrantProperty
  ];
  oThis.propertySetBitValue = null;
};

neverAirdroppedKlass.prototype = Object.create(baseKlass.prototype);

const neverAirdroppedKlassPrototype = {};

Object.assign(neverAirdroppedKlass.prototype, neverAirdroppedKlassPrototype);

InstanceComposer.registerShadowableClass(neverAirdroppedKlass, 'getNeverAirdroppedClass');

module.exports = neverAirdroppedKlass;
