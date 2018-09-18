'use strict';

const Buffer = require('safe-buffer').Buffer,
  Tx = require('ethereumjs-tx'),
  BigNumber = require('bignumber.js');

const rootPrefix = '../..';

// Please declare your require variable here.
let nonceManagerKlass, responseHelper, logger, coreConstants, valueChainGasPriceCacheKlass;

// NOTE :: Please define all your requires inside the function
function initRequires() {
  nonceManagerKlass = nonceManagerKlass || require(rootPrefix + '/module_overrides/web3_eth/nonce_manager');
  responseHelper = responseHelper || require(rootPrefix + '/lib/formatter/response');
  logger = logger || require(rootPrefix + '/lib/logger/custom_console_logger');
  valueChainGasPriceCacheKlass =
    valueChainGasPriceCacheKlass || require(rootPrefix + '/lib/shared_cache_management/estimate_value_chain_gas_price');
  coreConstants = coreConstants || require(rootPrefix + '/config/core_constants');
}

const SignRawTx = function (rawTx) {
  const oThis = this;

  logger.debug('arguments of sendTransaction', arguments)

  oThis.rawTx = rawTx;

  // declaring the vars which will be populated while perform
  oThis.privateKeyObj = null;
};

SignRawTx.prototype = {
  perform: async function () {
    const oThis = this;

    oThis._sanitize();


  },

  _sanitize: function () {
    const oThis = this;

    // convert to hex
    let value = new BigNumber(oThis.rawTx.value || 0);
    oThis.rawTx.value = '0x' + value.toString(16);
  },

  _getPrivateKey: async function() {
    const fetchPrivateKeyObj = new fetchPrivateKeyKlass({ address: fromAddress }),
      fetchPrivateKeyRsp = await fetchPrivateKeyObj.fetchDecryptedData();

    if (fetchPrivateKeyRsp.isFailure()) {
      const errorMsg = 'Private key not found for address: ' + fromAddress;

      hackedReturnedPromiEvent.eventEmitter.emit('error', errorMsg);
      hackedReturnedPromiEvent.reject(errorMsg);

      return Promise.reject(errorMsg);
    }

    // Get private key - this should be the private key without 0x at the beginning.
    let privateKey = fetchPrivateKeyRsp.data['private_key_d'];
    if (privateKey.slice(0, 2).toLowerCase() === '0x') {
      privateKey = privateKey.substr(2);
    }

    privateKeyObj = new Buffer(privateKey, 'hex');
    clientId = fetchPrivateKeyRsp.data['client_id'];

    return Promise.resolve();
  }
};

module.exports = SignRawTx;