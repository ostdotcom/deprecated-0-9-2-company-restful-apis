/**
 * This script is used to fill the missing nonce.
 *
 * @module executables/fire_brigade/fill_up_missing_nonce
 */

const rootPrefix = '../..',
  nonceHelperKlass = require(rootPrefix + '/module_overrides/web3_eth/nonce_helper'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  FillUpMissingNonceKlass = require(rootPrefix + '/executables/fire_brigade/fill_up_missing_nonce');

/**
 * parameters
 *
 * @param {object} params - external passed parameters
 * @param {String} params.from_address - from_address
 * @param {String} params.to_address - to_address
 * @param {String} params.chain_kind - chain_kind (value | utilty)
 * @param {Integer} params.missing_nonce - missing_nonce
 * @param {array} params.geth_providers - geth_provider (WS | RPC)
 * @param {String} params.gas_price - gas_price
 *
 *
 * @module executables/fire_brigade/fill_up_missing_nonce
 */

const FillUpMissingNonceRange = function(params) {
  const oThis = this;
  oThis.nonceHelper = new nonceHelperKlass();
  oThis.toAddress = params.to_address.toLowerCase();
  oThis.chainKind = params.chain_kind;
  oThis.gasPrice = params.gas_price;
  oThis.gethProviders = params.geth_providers;
  oThis.allPendingTasks = [];
  oThis.isProccessing = false;
  oThis.currentIndex = 0;
};

FillUpMissingNonceRange.prototype = {
  perform: async function() {
    const oThis = this;

    const clearQueuedResponse = await oThis.nonceHelper.clearAllMissingNonce(
      oThis.chainKind,
      oThis,
      oThis.fillNonce,
      oThis.gethProviders
    );
    if (clearQueuedResponse.isFailure()) {
      logger.error('Unable to clear queued transactions: ', clearQueuedResponse);
    } else {
      logger.win('Cleared queued transactions successfully: ', clearQueuedResponse);
    }
  },

  fillNonce: function(address, nonce) {
    const oThis = this,
      params = {};
    params['from_address'] = address.toLowerCase();
    params['to_address'] = oThis.toAddress;
    params['chain_kind'] = oThis.chainKind;
    params['missing_nonce'] = parseInt(nonce);
    params['gas_price'] = oThis.gasPrice;
    params['geth_provider'] = oThis.gethProviders[0];

    oThis.addToBatchProcess(params);
  },

  addToBatchProcess: function(object) {
    const oThis = this;
    oThis.allPendingTasks.push(object);
    if (!oThis.isProccessing) {
      oThis.isProccessing = true;
      oThis.batchProcess();
    }
    logger.info('------oThis.allPendingTasks.length: ', oThis.allPendingTasks.length);
  },

  batchProcess: async function() {
    const oThis = this;
    const batchSize = 100;
    while (oThis.currentIndex < oThis.allPendingTasks.length) {
      const allPromises = [];
      for (let count = 0; count < batchSize && oThis.currentIndex < oThis.allPendingTasks.length; count++) {
        const params = oThis.allPendingTasks[oThis.currentIndex];
        const promiseObject = new Promise(async function(onResolve, onReject) {
          const fillUpNonceObject = new FillUpMissingNonceKlass(params);
          await fillUpNonceObject.perform();
          onResolve();
        });
        allPromises.push(promiseObject);
        oThis.currentIndex++;
      }

      await Promise.all(allPromises);
      logger.log('=======================Batch complete======================');
    }
    oThis.isProccessing = false;
  }
};

module.exports = FillUpMissingNonceRange;

/*


Below is the code to run on console. Update toAddress and chainKind below.
====================================================================\

var rootPrefix = '.';
var FillUpMissingNonceRangeKlass = require(rootPrefix + '/executables/fire_brigade/fill_up_missing_nonce_range');
var fillUpObject = new FillUpMissingNonceRangeKlass({to_address: '0xb98209453EAD1c7D6b3b8EC91F59d3a113a8dBf9', chain_kind: 'utility', gas_price: 0, geth_providers: ['ws://127.0.0.1:19547']});
fillUpObject.perform().then(console.log);


Below is the code to run on console. To get current nonce of the address
====================================================================
var fromAddress = '0x7118cDDc59beeA8D9b31594118A5C6bC8dc8f455';
nonceManagerKlass = require(rootPrefix + '/module_overrides/web3_eth/nonce_manager');
 nonceManager = new nonceManagerKlass({address: fromAddress, chain_kind: chainKind});
 nonceManager.getNonce().then(function(response) {
  console.log("response: ", response);
  nonceManager.abort().then(console.log)
 });


Below is the test code. To mess up nonce for the given address. (Use only for pure testing purpose)
===========================================================================================
var fromAddress = '0x5FF02fd90Baec50A62D4eE19fD22fF96D42046a8';
var startNonce = 10
for (var diff1 = 0; diff1 < 10; diff1++ ) {
  startNonce = startNonce+diff1;
  var diff = 5;
  for (var i = startNonce; i < startNonce+diff; i++ ) {
    fillUpObject.fillNonce(fromAddress, i);
    fillUpObject.batchProcess()
  }
}



 */
