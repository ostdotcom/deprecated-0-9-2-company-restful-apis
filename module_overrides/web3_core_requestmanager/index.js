//IMPORTANT: Unlike other Packages, this package cache does not need to be manuplated.

const basePackage = 'web3-core-requestmanager';

const BasePackage = require(basePackage),
  Buffer = require('safe-buffer').Buffer,
  Tx = require('ethereumjs-tx'),
  BigNumber = require('bignumber.js');

const rootPrefix = '../..';

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

OstBatchManager.prototype = Object.create(Web3BatchManager.prototype);

//Override add method.
let orgAdd = Web3BatchManager.prototype.add;
OstBatchManager.prototype.add = function(request, cb) {
  const oBatch = this;
  orgAdd.apply(oBatch, arguments);
  if (!request.callback) {
    request.callback = cb;
  }
  console.log('We have new request:', request);
};

OstBatchManager.isOSTVersion = true;

//IMPORTANT: Unlike other Packages, this package cache does not need to be manuplated.
BasePackage.BatchManager = OstBatchManager;

module.exports = BasePackage;
