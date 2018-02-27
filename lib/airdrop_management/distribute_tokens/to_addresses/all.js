"use strict";

/**
 *
 * Start adding airdrop details for all users <br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/to_addresses/all
 *
 */

const rootPrefix = '../../../..'
  , baseKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/to_addresses/base')
;

/**
 * Start adding airdrop details for all users constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_airdrop_obj - client airdrop obj
 *
 * @constructor
 *
 */
const allKlass = function (params) {

  const oThis = this;

  oThis.clientAirdropObj = params.client_airdrop_obj;
  oThis.client_id = oThis.clientAirdropObj.client_id;

  // Filter required to fetch appropriate users
  oThis.propertyUnsetBitValue = null;

};

allKlass.prototype = Object.create(baseKlass.prototype);

const allKlassPrototype = {};

Object.assign(allKlass.prototype, allKlassPrototype);

module.exports = allKlass;