/**
 * This script is used to fill the missing nonce.
 *
 * @module executables/fire_brigade/fill_up_missing_nonce
 */
const Buffer = require('safe-buffer').Buffer,
  Tx = require('ethereumjs-tx');

const rootPrefix = '../..',
  fetchPrivateKeyKlass = require(rootPrefix + '/lib/shared_cache_management/address_private_key'),
  nonceHelperKlass = require(rootPrefix + '/module_overrides/web3_eth/nonce_helper'),
  nonceHelper = new nonceHelperKlass();

/**
 * parameters
 *
 * @param {object} params - external passed parameters
 * @param {String} params.from_address - from_address
 * @param {String} params.to_address - to_address
 * @param {String} params.chain_type - chain_type (geth | parity)
 * @param {Integer} params.missing_nonce - missing_nonce
 * @param {String} params.geth_provider - geth_provider (WS | RPC)
 * @param {String} params.gas_price - gas_price
 *
 *
 */

const FillUpMissingNonce = function(params) {
  const oThis = this;

  oThis.fromAddress = params.from_address.toLowerCase();
  oThis.toAddress = params.to_address.toLowerCase();
  oThis.chainType = params.chain_type;
  oThis.missingNonce = params.missing_nonce;
  oThis.provider = params.geth_provider;
  oThis.gasPrice = params.gas_price;
  oThis.privateKeyObj = null;
  oThis.rawTx = null;
};

FillUpMissingNonce.prototype = {
  perform: async function() {
    const oThis = this;

    await oThis.initializeRawTx();

    await oThis.setPrivateKey();

    await oThis.sendSignedTx();
  },

  initializeRawTx: function() {
    const oThis = this;

    oThis.rawTx = {
      from: oThis.fromAddress,
      to: oThis.toAddress,
      value: '0x1',
      gasPrice: oThis.gasPrice,
      gas: 25000,
      nonce: oThis.missingNonce
    };

    return Promise.resolve();
  },

  setPrivateKey: async function() {
    const oThis = this,
      fetchPrivateKeyObj = new fetchPrivateKeyKlass({ address: oThis.fromAddress }),
      fetchPrivateKeyRsp = await fetchPrivateKeyObj.fetchDecryptedData();

    if (fetchPrivateKeyRsp.isFailure()) {
      throw 'private key not found';
    }

    // get private key - this should be the private key without 0x at the beginning.
    let privateKey = fetchPrivateKeyRsp.data['private_key_d'];
    if (privateKey.slice(0, 2).toLowerCase() === '0x') {
      privateKey = privateKey.substr(2);
    }

    oThis.privateKeyObj = new Buffer(privateKey, 'hex');

    return Promise.resolve();
  },

  sendSignedTx: function() {
    const oThis = this;

    const tx = new Tx(oThis.rawTx);

    tx.sign(oThis.privateKeyObj);

    const serializedTx = tx.serialize();

    const providerObj = nonceHelper.getWeb3Instance(oThis.provider, oThis.chainType);

    return providerObj.eth
      .sendSignedTransaction('0x' + serializedTx.toString('hex'))
      .once('transactionHash', function(txHash) {
        console.log('transaction_hash:', txHash);
      })
      .once('receipt', function(receipt) {
        console.log('receipt:', receipt);
      })
      .on('error', function(error) {
        console.log('error:', error);
      });
  }
};

module.exports = FillUpMissingNonce;

/*

Below is an example how to use this script on console
========================================================================

FillUp = require('./executables/fire_brigade/fill_up_missing_nonce');
fillUp = new FillUp({ from_address: '0xeb85d9fe123a76bd01d78a0c3f103216a56cba33', to_address: '0x616F76d7e749a68b24f5449bcA520f30CA0F7Aa6', chain_type: 'geth', missing_nonce: 21, geth_provider: 'ws://127.0.0.1:19548', gas_price: '0x3B9ACA00'});

fillUp.perform().then(console.log);

*/
