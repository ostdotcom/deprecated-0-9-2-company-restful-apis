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
 * @param {String} params.chain_type - chain_type (geth | parity)
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
  oThis.chainType = params.chain_type;
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
      oThis.chainType,
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
    params['chain_type'] = oThis.chainType;
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


Below is the code to run on console. Update toAddress and chainType below.
====================================================================\

var rootPrefix = '.';
var FillUpMissingNonceRangeKlass = require(rootPrefix + '/executables/fire_brigade/fill_up_missing_nonce_range');
var fillUpObject = new FillUpMissingNonceRangeKlass({to_address: '0xeB85d9fE123A76Bd01d78a0C3F103216a56cbA33', chain_type: 'geth', gas_price: '0x3B9ACA00', geth_providers: ['ws://127.0.0.1:19548']});
fillUpObject.perform().then(console.log);

 */
