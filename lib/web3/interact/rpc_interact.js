"use strict";
/**
 * Web3 RPC provider
 *
 * @module lib/web3/interact/rpc_interact
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
 * @param  {String} webrpc - RPC provider
 *
 * @constructor
 */
const web3Interact = function (webrpc) {
  const oThis = this;

  //Define web3PoolFactory
  Object.defineProperty(oThis, "web3RpcProvider", {
    get: function () {
      return web3PoolFactory.getWeb3( webrpc );
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
  }
};

// To create Singleton instance
const web3InteractHelper = (function () {
  const instances = {};

  function createInstance(webRpcURL) {
    return new web3Interact(webRpcURL);
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
    },

    setInstance: function (chainId, instance) {
      instances[chainId] = instance;
    }
  };
})();

module.exports = web3InteractHelper;