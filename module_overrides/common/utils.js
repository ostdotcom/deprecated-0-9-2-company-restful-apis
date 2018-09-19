'use strict';

const rootPrefix = '../..';

let coreConstants;

let ModuleOverrides = function() {};

ModuleOverrides.prototype = {
  maxRetryCount: 2,

  getUnlockableKeysMap: function() {
    coreConstants = coreConstants || require(rootPrefix + '/config/core_constants');
    return coreConstants.ADDRESSES_TO_UNLOCK_VIA_KEYSTORE_FILE_MAP || {};
  },

  isUnlockable: function(address) {
    const oThis = this;
    console.log('address', address);
    address = address.toLowerCase();
    return oThis.getUnlockableKeysMap()[address] ? true : false;
  },

  isNonceTooLowError: function (error) {
    if ( !error || !error.message ) {
      throw 'invalid error object passed.';
    }
    return error.message.indexOf('nonce too low') > -1;
  },

  getHost: function(provider) {
    return provider.host ? provider.host : provider.connection._url;
  }
};

module.exports = new ModuleOverrides();
