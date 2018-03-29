"use strict";

const OstCore       = require("@openstfoundation/openst-core")
  , OstWeb3       = OstCore.OstWeb3
  , BigNumber = require('bignumber.js')
  , web3InstanceMap = {}
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

const getWeb3Instance = function (gethURL, chainKind) {
  const existingInstance = web3InstanceMap[gethURL];
  if (existingInstance){
    return existingInstance;
  }

  const newInstance =  new OstWeb3(gethURL, null, {
    providerOptions: {
      maxReconnectTries: 20,
      killOnReconnectFailuer: false
    }
  });

  newInstance.chainKind = chainKind;
  newInstance.extend({
    methods: [{
      name: 'pendingTransactions',
      call: 'txpool_content',
    }]
  });

  web3InstanceMap[gethURL] = newInstance;

  return newInstance;
};

const instanceMap = {};
function getInstanceKey( fromAddress, chainKind ) {
  var args = Array.prototype.slice.call(arguments);
  return args.join("_");
}
function getInstance( instanceKey ) {
  logger.log("NM :: getInstance :: instanceKey", instanceKey );
  return instanceMap[ instanceKey ];
}
function setInstance(instance, instanceKey ) {
  if ( instanceMap[ instanceKey ] ) {
    logger.error("NM :: setInstance :: called when an instance already exists");
    return false;
  }

  instanceMap[ instanceKey ] = instance;
  return true;
}

/**
 * @constructor
 *
 *
 */
const NonceHelperKlass = function() {};

const NonceHelperKlassPrototype = {

  /**
   * Get web3 instance for the given gethURL and chainKind
   *
   * @param {string} gethURL - geth provider url
   * @param {string} chainKind - chain kind e.g value, utility
   *
   * @return {promise<result>}
   */
  getWeb3Instance: function (gethURL, chainKind) {
    return getWeb3Instance(gethURL, chainKind);
  },

  getInstanceKey: function (fromAddress, chainKind) {
    return getInstanceKey(fromAddress, chainKind);
  },

  getInstance: function (instanceKey) {
    return getInstance(instanceKey);
  },

  setInstance: function (instance, instanceKey) {
    return setInstance(instance, instanceKey);
  },

  /**
   * Get mined transaction count for given address
   *
   * @param {string} chainKind - chain kind e.g value, utility
   * @param {string} address - address whose nonce to be cleared
   *
   * @return {promise<result>}
   */
  getMinedTransactionCount: function (chainKind, address) {
    const oThis = this;

    try {
      const allNoncePromise = []
        , allGethNodes = oThis._getAllGethNodes(chainKind);
      ;

      for (var i = allGethNodes.length - 1; i >= 0; i--) {
        const gethURL = allGethNodes[i];

        const web3Provider = oThis.getWeb3Instance(gethURL, chainKind);
        allNoncePromise.push(oThis.getNonceFromGethNode(address, web3Provider));
      }

      const allNoncePromiseResult = Promise.all(allNoncePromise);

      var isNonceAvailable = false;
      var nonceCount = 0;
      for (var i = allNoncePromiseResult.length - 1; i >= 0; i--) {
        const currentNonceResponse =  allNoncePromiseResult[i];
        if (currentNonceResponse.isFailure()) {
          continue;
        }
        const currentNonce = new BigNumber(currentNonceResponse.data.mined_transaction_count);
        nonceCount = BigNumber.max(currentNonce, nonceCount);
        isNonceAvailable = true;
      }
      if (isNonceAvailable==false) {
        return Promise.resolve(responseHelper.error("mo_w_nh_getTransactionCount_1", "Unable to get transaction count"));
      }

      return Promise.resolve(responseHelper.successWithData({nonce: nonceCount}));

    } catch (err) {
      //Format the error
      logger.error("module_overrides/web3_eth/nonce_helper.js:getTransactionCount inside catch ", err);
      return Promise.resolve(responseHelper.error('mo_w_nh_getTransactionCount_2', 'Unable to get transaction count'));
    }

  },

  /**
   * Get all queued transactions
   *
   * @param {string} chainKind - chain kind e.g value, utility
   *
   * @return {promise<result>}
   */
  getAllQueuedTransaction: async function(chainKind) {

    const oThis = this;

    try {

      const allTxPoolPromise = []
        , allGethNodes = oThis._getAllGethNodes(chainKind)
      ;

      for (var i = allGethNodes.length - 1; i >= 0; i--) {
        const gethURL = allGethNodes[i];
        const web3Provider = oThis.getWeb3Instance(gethURL, chainKind);
        allTxPoolPromise.push(oThis.getPendingTransactionsFromGethNode(web3Provider));
      }

      const allTxPoolPromiseResult = await Promise.all(allTxPoolPromise);
      const queuedData = {};

      console.log("allTxPoolPromiseResult: ",allTxPoolPromiseResult);
      var isTransactionAvailable = false;

      for (var i = allTxPoolPromiseResult.length - 1; i >= 0; i--){
        const currentTxPoolResponse =  allTxPoolPromiseResult[i];
        if (currentTxPoolResponse.isFailure()) {
          continue;
        }

        const pendingTransaction = currentTxPoolResponse.data.pending_transaction.pending;
        const queuedTransaction = currentTxPoolResponse.data.pending_transaction.queued;

        for (var address in pendingTransaction) {
          queuedData[address] = queuedData[address] || {};
          Object.assign(queuedData[address],pendingTransaction[address]);
        }

        for (var address in queuedTransaction) {
          queuedData[address] = queuedData[address] || {};
          Object.assign(queuedData[address],queuedTransaction[address]);
        }
        isTransactionAvailable = true;
      }

      if (isTransactionAvailable == false) {
        return Promise.resolve(responseHelper.error("mo_w_nh_getAllQueuedTransaction_1", 'Unable to get queued transactions'));
      }
      return Promise.resolve(responseHelper.successWithData({queuedData: queuedData}));

    } catch (err) {
      //Format the error
      logger.error("module_overrides/web3_eth/nonce_helper.js:getAllQueuedTransaction inside catch ", err);
      return Promise.resolve(responseHelper.error('mo_w_nh_getAllQueuedTransaction_2', 'Unable to get queued transactions'));
    }


  },


  /**
   * Clear all missing nonce
   *
   * @param {string} chainKind - chain kind e.g value, utility
   * @param {object} scope - caller scope
   * @param {function} clearCallback - call back function that needs to be called when missing nonce is found
   *
   * @return {promise<result>}
   */
  clearAllMissingNonce: async function (chainKind, scope, clearCallback) {
    const oThis = this;

    try {
      const allQueuedTransaction = await oThis.getAllQueuedTransaction(chainKind);
      if (allQueuedTransaction.isFailure()) {
        return Promise.resolve(responseHelper.error('mo_w_nh_clearAllMissingNonce_1',
          'unable to get all queued transaction'));
      }
      var successAddresses = new Array()
        , failAddresses = new Array()
      ;

      const queuedData = allQueuedTransaction.data.queuedData;
      for (var address in queuedData) {

        const clearResponce =  await oThis.clearMissingNonce(address, chainKind, queuedData[address], scope, clearCallback);
        if (clearResponce.isSuccess()) {
          successAddresses.push(address);
        } else {
          failAddresses.push(address);
        }
      }

      return Promise.resolve(responseHelper.successWithData({successAddresses:successAddresses, failAddresses:failAddresses}));
    } catch (err) {
      //Format the error
      logger.error("module_overrides/web3_eth/nonce_helper.js:clearAllMissingNonce inside catch ", err);
      return Promise.resolve(responseHelper.error('mo_w_nh_clearAllMissingNonce_2',
        'Something went wrong while clearing missing nonce'));
    }


  },

  /**
   * Clear all missing nonce for a given address
   *
   * @param {string} address - address whose nonce to be cleared
   * @param {string} chainKind - chain kind e.g value, utility
   * @param {array} pendingTransactions - array of pending transaction
   * @param {object} scope - caller scope
   * @param {function} clearCallback - call back function that needs to be called when missing nonce is found
   *
   * @return {promise<result>}
   */
  clearMissingNonce: async function (address, chainKind, pendingTransactions, scope, clearCallback) {
    const oThis = this;

    if (!clearCallback) {
      return Promise.resolve(responseHelper.error('mo_w_nh_clearMissingNonce_1',
        'call back function is mandatory'));
    }

    try {


      const allNoncePromise = []
        , allGethNodes = oThis._getAllGethNodes(chainKind)
      ;

      for (var i = allGethNodes.length - 1; i >= 0; i--) {
        const gethURL = allGethNodes[i];

        const web3Provider = oThis.getWeb3Instance(gethURL, chainKind);
        allNoncePromise.push(oThis.getNonceFromGethNode(address, web3Provider));
      }

      const allNoncePromiseResult = await Promise.all(allNoncePromise);

      var nonceCount = 0;
      for (var i = allNoncePromiseResult.length - 1; i >= 0; i--) {
        const currentNonceResponse =  allNoncePromiseResult[i];
        if (currentNonceResponse.isFailure()) {
          continue;
        }
        const currentNonce = new BigNumber(currentNonceResponse.data.mined_transaction_count);
        nonceCount = BigNumber.max(currentNonce, nonceCount);
      }

      const maxNonceCount = Math.max(...Object.keys(pendingTransactions));

      for (var nonce = nonceCount; nonce <= maxNonceCount; nonce++ ) {
        // fix  nonce code here
        const bgNonce = new BigNumber(nonce);
        const nonceString = `${bgNonce.toString(10)}`;
        if (!pendingTransactions[nonceString]) {

          clearCallback.apply(scope, [address, nonceString]);

          //clearCallback(address, nonceString);
        }
      }

      return Promise.resolve(responseHelper.successWithData({address: address}));

    } catch (err) {
      //Format the error
      logger.error("module_overrides/web3_eth/nonce_helper.js:clearMissingNonce inside catch ", err);
      return Promise.resolve(responseHelper.error('mo_w_nh_clearMissingNonce_2',
        'Something went wrong while clearing missing nonce'));
    }

  },

  /**
   * Get transactionCount
   *
   * @param {object} web3Provider - web3 object
   *
   * @return {promise<result>}
   */
  getNonceFromGethNode: async function(address, web3Provider){
    const oThis = this
    ;

    return new Promise(function(onResolve, onReject) {
      try {
        web3Provider.eth.getTransactionCount(address, function(error, result) {
          if (error) {
            return onResolve(responseHelper.error('mo_w_nh_getNonceFromGethNode_1', error));
          } else {
            return onResolve(responseHelper.successWithData({mined_transaction_count: result}));
          }
        });
      } catch (err) {
        //Format the error
        logger.error("module_overrides/web3_eth/nonce_helper.js:getNonceFromGethNode inside catch ", err);
        return onResolve(responseHelper.error('mo_w_nh_getNonceFromGethNode_2', 'Something went wrong'));
      }
    });
  },


  /**
   * Get pending transactions
   *
   * @param {object} web3Provider - web3 object
   *
   * @return {promise<result>}
   */
  getPendingTransactionsFromGethNode: async function(web3Provider){
    const oThis = this
    ;

    return new Promise(async function(onResolve, onReject) {
      try {

        const pendingTransaction = await web3Provider.pendingTransactions();

        console.log("pendingTransaction: ",pendingTransaction);
        if (pendingTransaction) {
          return onResolve(responseHelper.successWithData({pending_transaction: pendingTransaction}));
        }
        return onResolve(responseHelper.error('mo_w_nh_getPendingTransactionsFromGethNode_1', 'Something went wrong'));

      } catch (err) {
        //Format the error
        logger.error("module_overrides/web3_eth/nonce_helper.js:getPendingTransactionsFromGethNode inside catch ", err);
        return onResolve(responseHelper.error('mo_w_nh_getPendingTransactionsFromGethNode_2', 'Something went wrong'));
      }
    });

  },

  /**
   * Get all geth nodes for the given chain kind
   *
   * @param {string} chainKind - chain kind e.g value, utility
   *
   * @return {string}
   */
  _getAllGethNodes: function (chainKind) {
    return (chainKind == 'value') ? chainInteractionConstants.OST_VALUE_GETH_WS_PROVIDERS :
      chainInteractionConstants.OST_UTILITY_GETH_WS_PROVIDERS
  }
};

Object.assign(NonceHelperKlass.prototype, NonceHelperKlassPrototype);

module.exports = NonceHelperKlass;
