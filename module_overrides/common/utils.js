'use strict';

const rootPrefix = '../..';

let coreConstants;

let ModuleOverrideUtils = function() {};

ModuleOverrideUtils.prototype = {
  nonceTooLowErrorMaxRetryCnt: 0,
  chainNodeDownErrorMaxRetryCnt: 10,

  exceptableBlockDelayAmongstNodes: 100,

  /**
   * Map of addresses for which the keystore file exists
   *
   * @returns {object}
   */
  getUnlockableKeysMap: function() {
    coreConstants = coreConstants || require(rootPrefix + '/config/core_constants');
    return coreConstants.ADDRESSES_TO_UNLOCK_VIA_KEYSTORE_FILE_MAP || {};
  },

  /**
   * Is unlockable
   *
   * @param address - eth address
   * @returns {boolean}
   */
  isUnlockable: function(address) {
    const oThis = this;
    address = address.toLowerCase();
    return oThis.getUnlockableKeysMap()[address] ? true : false;
  },

  /**
   * is nonce too low error
   *
   * @param error
   * @returns {boolean}
   */
  isNonceTooLowError: function(error) {
    if (!error || !error.message) {
      return false;
    }
    return error.message.indexOf('nonce too low') > -1 || error.message.indexOf('Transaction nonce is too low') > -1;
  },

  /**
   * is chain node down error
   *
   * @param error
   * @returns {boolean}
   */
  isChainNodeDownError: function(error) {
    if (!error || !error.message) {
      return false;
    }
    return error.message.indexOf('Invalid JSON RPC response') > -1 || error.message.indexOf('connection not open') > -1;
  },

  /**
   * is gas low error
   *
   * @param error
   * @returns {boolean}
   */
  isGasLowError: function(error) {
    if (!error || !error.message) {
      return false;
    }
    return error.message.indexOf('insufficient funds for gas * price + value') > -1;
  },

  /**
   * is replacement tx under oriced error
   *
   * @param error
   * @returns {boolean}
   */
  isReplacementTxUnderPricedError: function(error) {
    if (!error || !error.message) {
      return false;
    }
    // with a nonce which was already used,
    // 1. if same rawTx was resubmitted -> known transaction error is raised
    // 2. if some other rawTx was submitted -> replacement transaction underpriced
    return (
      error.message.indexOf('replacement transaction underpriced') > -1 ||
      error.message.indexOf('known transaction') > -1
    );
  },

  /**
   * get host from the web3 provider
   *
   * @param provider
   * @returns {*}
   */
  getHost: function(provider) {
    return provider.host ? provider.host : provider.connection._url;
  },

  /**
   * submit transaction to chain
   *
   * @param params
   */
  submitTransactionToChain: function(params) {
    let pSignTxRsp = params['signTxRsp'],
      onError = params['onError'],
      onReject = params['onReject'],
      onTxHash = params['onTxHash'],
      orgCallback = params['orgCallback'],
      web3Instance = params['web3Instance'];

    let BatchRequestKlass = web3Instance.BatchRequest || web3Instance.eth.BatchRequest,
      batchRequest = new BatchRequestKlass(),
      sendSignedTransactionMethod = web3Instance.sendSignedTransaction || web3Instance.eth.sendSignedTransaction;

    let sendSignedTransactionRequest = sendSignedTransactionMethod.request(
      '0x' + pSignTxRsp['serializedTx'].toString('hex')
    );

    sendSignedTransactionRequest.callback = function(err, txHash) {
      try {
        err && onError && onError(err);
        err && onReject && onReject(err);
      } catch (e) {}

      try {
        txHash && onTxHash && onTxHash(txHash);
      } catch (e) {}
      try {
        orgCallback && orgCallback(err, txHash);
      } catch (e) {}
    };

    batchRequest.add(sendSignedTransactionRequest);
    batchRequest.execute();
  }
};

module.exports = new ModuleOverrideUtils();
