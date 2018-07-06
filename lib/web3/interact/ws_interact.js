"use strict";

/**
 * Web3 WS provider
 *
 * @module lib/web3/interact/ws_interact
 */
// Load external libraries

const OSTBase = require('@openstfoundation/openst-base')
;

// Load internal files
const rootPrefix = '../../..'
  , web3PoolFactory = OSTBase.OstWeb3Pool.Factory
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
;

/**
 * Web3 Interact constructor
 *
 * @param  {String} webws - WS provider
 *
 * @constructor
 */
const web3Interact = function (webws) {
  const oThis = this;

  //Define web3PoolFactory
  Object.defineProperty(oThis, "web3RpcProvider", {
    get: function () {
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
  getReceipt: function (transactionHash) {
    const oThis = this
    ;

    return oThis.web3RpcProvider.eth.getTransactionReceipt(transactionHash);
  },

  /**
   * Get block details using a block number
   *
   * @param  {Integer} blockNumber - Block Number
   * @return {Promise}
   */
  getBlock: function (blockNumber) {
    const oThis = this
    ;

    return oThis.web3RpcProvider.eth.getBlock(blockNumber, false);
  },

  /**
   * Get block number
   *
   * @return {promise}
   */
  getBlockNumber: function () {
    const oThis = this
    ;

    return oThis.web3RpcProvider.eth.getBlockNumber();
  }
};

// To create Singleton instance
const web3InteractHelper = (function () {
  const instances = {};

  function createInstance(webWsURL) {
    return new web3Interact(webWsURL);
  }

  return {
    getInstance: function (chainType) {
      const existingInstance = instances[chainType];

      if(existingInstance) return existingInstance;

      let provider = (chainType == 'utility') ? chainInteractionConstants.UTILITY_GETH_WS_PROVIDER :
        chainInteractionConstants.VALUE_GETH_WS_PROVIDER;

      const newInstance = createInstance(provider);

      // TODO:: change this to chain id in future when multiple chains come into existence
      instances[chainType] = newInstance;

      return newInstance;
    }
  };
})();

module.exports = web3InteractHelper;