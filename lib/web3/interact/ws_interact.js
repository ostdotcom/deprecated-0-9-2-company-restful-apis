'use strict';

/**
 * Web3 WS provider
 *
 * @module lib/web3/interact/ws_interact
 */
// Load external libraries

const OSTBase = require('@openstfoundation/openst-base');

// Load internal files
const rootPrefix = '../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  web3PoolFactory = OSTBase.OstWeb3Pool.Factory;

/**
 * Web3 Interact constructor
 *
 * @param  {String} webws - WS provider
 *
 * @constructor
 */
const web3Interact = function(webws) {
  const oThis = this;

  //Define web3PoolFactory
  Object.defineProperty(oThis, 'web3WsProvider', {
    get: function() {
      return web3PoolFactory.getWeb3(webws);
    }
  });
};

web3Interact.prototype = {
  /**
   * Get transaction receipt of a given transaction hash
   *
   * @param  {String} transactionHash - Transaction Hash
   * @return {Promise}
   */
  getReceipt: function(transactionHash) {
    const oThis = this;

    return oThis.web3WsProvider.eth.getTransactionReceipt(transactionHash);
  },

  /**
   * Get block details using a block number
   *
   * @param  {Integer} blockNumber - Block Number
   * @return {Promise}
   */
  getBlock: function(blockNumber) {
    const oThis = this;

    return oThis.web3WsProvider.eth.getBlock(blockNumber, false);
  },

  /**
   * Get block number
   *
   * @return {Promise}
   */
  getBlockNumber: function() {
    const oThis = this;

    return oThis.web3WsProvider.eth.getBlockNumber();
  },

  /**
   * Get transaction details using a transaction hash.
   *
   * @param transactionHash
   * @returns {Promise<Transaction>}
   */
  getTransaction: function(transactionHash) {
    const oThis = this;

    return oThis.web3WsProvider.eth.getTransaction(transactionHash);
  }
};

const Web3InteractHelperKlass = function() {
  const oThis = this;

  oThis.instances = {};
};

Web3InteractHelperKlass.prototype = {
  instances: null,

  getInstance: function(chainType, provider) {
    const oThis = this,
      existingInstance = oThis.instances[chainType + provider],
      configStrategy = oThis.ic().configStrategy;

    if (existingInstance) return existingInstance;

    if (chainType == 'utility') {
      provider = provider ? provider : configStrategy.OST_UTILITY_GETH_WS_PROVIDER;
    } else {
      provider = configStrategy.OST_VALUE_GETH_WS_PROVIDER;
    }

    const newInstance = oThis._createInstance(provider);

    // TODO:: change this to chain id in future when multiple chains come into existence
    oThis.instances[chainType + provider] = newInstance;

    return newInstance;
  },

  _createInstance(webWsURL) {
    return new web3Interact(webWsURL);
  }
};

InstanceComposer.register(Web3InteractHelperKlass, 'getWeb3InteractHelper', true);

module.exports = Web3InteractHelperKlass;
