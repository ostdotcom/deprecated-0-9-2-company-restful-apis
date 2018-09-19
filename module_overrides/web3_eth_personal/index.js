'use strict';

const basePackage = 'web3-eth-personal';

const BasePackage = require(basePackage);

const rootPrefix = '../..';

// Please declare your require variable here.
let logger, moUtils;

// NOTE :: Please define all your requires inside the function
function initRequires() {
  logger = logger || require(rootPrefix + '/lib/logger/custom_console_logger');
  moUtils = require(rootPrefix + '/module_overrides/common/utils');
}

// Module Override Code - Part 1
var requireData, resolvedId, resolvedFileName;

for (var k in require.cache) {
  if (k.indexOf('/' + basePackage + '/src/index.js') > -1) {
    requireData = require.cache[k];
    resolvedId = requireData.id;
    resolvedFileName = requireData.filename;
    delete require.cache[k];
  }
}

// Derived Class Definition/Implementation
const Derived = function() {
  var oThis = this;

  initRequires();

  //Constructor sometimes return other instance of object.
  //Always have a safety-net
  const output = BasePackage.apply(oThis, arguments);
  //Safety Net
  oThis = output || oThis;

  const _unlockAccount = oThis.unlockAccount;

  // over-riding unlockAccount method
  oThis.unlockAccount = function(address, password, unlockDuraction, callback) {
    logger.debug('HACKED unlockAccount INVOKED');

    // if address has passphrase, use the base package unlock account.
    if (moUtils.isUnlockable(address)) {
      logger.info('WEB3_OVERRIDE: performing unlockAccount using passphrase for address:', address);
      return _unlockAccount.apply(this, arguments);
    } else {
      logger.info('WEB3_OVERRIDE: dummy response for unlockAccount for address:', address);
      callback && callback(null, true);
      return Promise.resolve(true);
    }
  };

  Object.assign(oThis.unlockAccount, _unlockAccount);

  return oThis;
};

Derived.isOSTVersion = true;

// Module Override Code - Part 2
require.cache[resolvedId] = {
  id: resolvedId,
  filename: resolvedFileName,
  loaded: true,
  exports: Derived
};

module.exports = Derived;
