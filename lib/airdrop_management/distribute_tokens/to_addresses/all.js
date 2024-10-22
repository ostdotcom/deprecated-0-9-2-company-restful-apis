'use strict';

/**
 *
 * Start adding airdrop details for all users <br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/to_addresses/all
 *
 */

const rootPrefix = '../../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  baseKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/to_addresses/base');

/**
 * Start adding airdrop details for all users constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_airdrop_obj - client airdrop obj
 *
 * @constructor
 *
 */
const allKlass = function(params) {
  const oThis = this;

  oThis.clientAirdropObj = params.client_airdrop_obj;
  oThis.client_id = oThis.clientAirdropObj.client_id;
  oThis.uuids = params.uuids;

  // Filter required to fetch appropriate users
  oThis.propertyUnsetBitValue = null;
  oThis.propertySetBitValue = null;
};

allKlass.prototype = Object.create(baseKlass.prototype);

const allKlassPrototype = {};

Object.assign(allKlass.prototype, allKlassPrototype);

InstanceComposer.registerShadowableClass(allKlass, 'getAllAddressesClass');

module.exports = allKlass;
