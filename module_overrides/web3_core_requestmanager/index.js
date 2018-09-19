//IMPORTANT: Unlike other Packages, this package cache does not need to be manipulated.

const basePackage = 'web3-core-requestmanager';

const BasePackage = require(basePackage),
  Buffer = require('safe-buffer').Buffer,
  Tx = require('ethereumjs-tx'),
  BigNumber = require('bignumber.js');

const rootPrefix = '../..';
const moUtils = require(rootPrefix + '/module_overrides/common/utils');

const Web3BatchManager = BasePackage.BatchManager;

// Please declare your require variable here.
let logger;

// NOTE :: Please define all your requires inside the function
function initRequires() {
  logger = logger || require(rootPrefix + '/lib/logger/custom_console_logger');
}

// Derived Class Definition/Implementation
const OstBatchManager = function() {
  var oThis = this;

  initRequires();

  //Constructor sometimes return other instance of object.
  //Always have a safety-net
  const output = Web3BatchManager.apply(oThis, arguments);
  //Safety Net
  oThis = output || oThis;
  //Do Stuff Here.

  return oThis;
};

let proto = {
  signRequest: function(request) {
    const oBatch = this;
  },
  _unlockRequests: null,
  addUnlockRequest: function(request) {
    const oBatch = this;
    oBatch._unlockRequests = oBatch._unlockRequests || [];
    oBatch._unlockRequests.push(request);
  },
  triggerUnlockCallbacks: function() {
    const oBatch = this;
    if (!oBatch._unlockRequests || oBatch._unlockRequests.length) {
      return;
    }

    let cnt = 0,
      len = oBatch._unlockRequests.length;
    for (cnt = 0; cnt < len; cnt++) {
      let request = oBatch._unlockRequests[cnt];
      request.callback && request.callback(true);
    }
  },
  executeCompleted: function() {
    const oBatch = this;
    oBatch.triggerUnlockCallbacks();
  }
};

OstBatchManager.prototype = Object.create(Web3BatchManager.prototype);
OstBatchManager.prototype = Object.assign(OstBatchManager.prototype, proto);

//Override add method.
let orgAdd = Web3BatchManager.prototype.add;
OstBatchManager.prototype.add = function(request, cb) {
  const oBatch = this;
  if (!request.callback) {
    request.callback = cb;
  }

  console.log('request', request);
  switch (request.method) {
    case 'eth_sendTransaction':
      if (!moUtils.isUnlockable(request.params[0].from)) {
        return oBatch.signRequest(request);
      }
      break;
    case 'personal_unlockAccount':
      if (!moUtils.isUnlockable(request.params[0])) {
        return oBatch.addUnlockRequest(request);
      }
      break;
  }

  //This request can be added.
  orgAdd.apply(oBatch, arguments);
};
let orgExecute = Web3BatchManager.prototype.execute;
OstBatchManager.prototype.execute = function() {
  const oBatch = this;

  //1. Execute super method.
  orgExecute.apply(oBatch, arguments);

  //2. add a dummy request object (use super 'add' method);
  let batchCompleteCallback = function() {
    oBatch.executeCompleted();
  };
  orgAdd.call(oBatch, {}, batchCompleteCallback);
};

OstBatchManager.isOSTVersion = true;

//IMPORTANT: Unlike other Packages, this package cache does not need to be manipulated.
BasePackage.BatchManager = OstBatchManager;

module.exports = BasePackage;
