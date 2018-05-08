"use strict";

const basePackage = 'web3-eth-personal'
;

const BasePackage = require(basePackage)
;

const rootPrefix = '../..';

var logger;

var requireData
  , resolvedId
  , resolvedFileName
;

for (var k in require.cache) {
  if (k.indexOf("/" + basePackage + "/src/index.js") > -1) {
    requireData = require.cache[k];
    resolvedId = requireData.id;
    resolvedFileName = requireData.filename;
    delete require.cache[k];
  }
}

const Derived = function () {
  var oThis = this
  ;

  defineGlobalNeeds();

  //Constructor sometimes return other instance of object.
  //Always have a safety-net
  const output = BasePackage.apply(oThis, arguments);
  //Safety Net
  oThis = output || oThis;



  const _unlockAccount = oThis.unlockAccount;

  // over-riding unlockAccount method
  oThis.unlockAccount = function () {

    logger.debug('HACKED unlockAccount INVOKED');

    const chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
      , addressToUnlock = arguments['0']
    ;

    // if address has passphrase, use the base package unlock account.
    if (chainInteractionConstants.ADDRESSES_TO_UNLOCK_VIA_KEYSTORE_FILE_MAP[addressToUnlock.toLowerCase()]) {
      logger.info('WEB3_OVERRIDE: performing unlockAccount using passphrase for address:', addressToUnlock);
      return _unlockAccount.apply(this, arguments);
    } else {
      logger.info('WEB3_OVERRIDE: dummy response for unlockAccount for address:', addressToUnlock);
      return Promise.resolve(true)
    }
  };

  return oThis;
};

Derived.isOSTVersion = true;

require.cache[resolvedId] = {
  id: resolvedId,
  filename: resolvedFileName,
  loaded: true,
  exports: Derived
};

module.exports = Derived;

// NOTE::THIS SHOULD NOT BE TAKEN AT THE TOP.
function defineGlobalNeeds() {
  logger = logger || require(rootPrefix + '/lib/logger/custom_console_logger');
}

