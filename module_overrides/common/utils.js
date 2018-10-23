'use strict';

const rootPrefix = '../..';

let coreConstants;

let ModuleOverrideUtils = function() {};

ModuleOverrideUtils.prototype = {
  nonceTooLowErrorMaxRetryCnt: 0,

  chainNodeDownErrorMaxRetryCnt: 10,

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

  isNonceTooLowError: function(error) {
    if (!error || !error.message) {
      throw 'invalid error object passed.';
    }
    return error.message.indexOf('nonce too low') > -1;
  },

  isChainNodeDownError: function(error) {
    if (!error || !error.message) {
      throw 'invalid error object passed.';
    }
    return error.message.indexOf('Invalid JSON RPC response') > -1 || error.message.indexOf('connection not open') > -1;
  },

  getHost: function(provider) {
    return provider.host ? provider.host : provider.connection._url;
  },

  submitTransactionToChain: function(params) {
    let pSignTxRsp = params['signTxRsp'],
      pOnError = params['onError'],
      pOnReject = params['onReject'],
      pOnTxHash = params['onTxHash'],
      pOrgCallback = params['orgCallback'],
      web3Instance = params['web3Instance'];

    let BatchRequestKlass = web3Instance.BatchRequest || web3Instance.eth.BatchRequest,
      batchRequest = new BatchRequestKlass(),
      sendSignedTransactionMethod = web3Instance.sendSignedTransaction || web3Instance.eth.sendSignedTransaction;

    let sendSignedTransactionRequest = sendSignedTransactionMethod.request(
      '0x' + pSignTxRsp['serializedTx'].toString('hex')
    );

    sendSignedTransactionRequest.callback = function(err, txHash) {
      console.error('errorObject', err);
      try {
        err && pOnError(err);
        err && pOnReject(err);
      } catch (e) {}
      try {
        txHash && pOnTxHash(txHash);
      } catch (e) {}
      try {
        pOrgCallback && pOrgCallback(err, txHash);
      } catch (e) {}
    };

    batchRequest.add(sendSignedTransactionRequest);
    batchRequest.execute();
  }
};

module.exports = new ModuleOverrideUtils();
