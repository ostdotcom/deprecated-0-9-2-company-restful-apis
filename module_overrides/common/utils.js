'use strict';
const rootPrefix = '../..';
let coreConstants;

let ModuleOverrides = function() {};

ModuleOverrides.prototype = {
  getUnlockableKeysMap: function() {
    coreConstants = coreConstants || require(rootPrefix + '/config/core_constants');
    return coreConstants.ADDRESSES_TO_UNLOCK_VIA_KEYSTORE_FILE_MAP || {};
  },
  isUnlockable: function(address) {
    const oThis = this;
    console.log('address', address);
    address = address.toLowerCase();
    return oThis.getUnlockableKeysMap()[address] ? true : false;
  }
};

module.exports = new ModuleOverrides();
