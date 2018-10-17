'use strict';

const OSTBase = require('@openstfoundation/openst-base'),
  OstWeb3 = OSTBase.OstWeb3,
  BigNumber = require('bignumber.js'),
  web3InstanceMap = {};

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy');

const getWeb3Instance = function(gethURL, chainType) {
  const existingInstance = web3InstanceMap[gethURL];

  if (existingInstance) {
    logger.log('Using existing web3 Instance of gethURL - ' + gethURL + ' and chainType ' + chainType);
    return existingInstance;
  }

  logger.log('Creating new web3 Instance of gethURL - ' + gethURL + ' and chainType ' + chainType);

  const newInstance = new OstWeb3(gethURL, null, {
    providerOptions: {
      maxReconnectTries: 20,
      killOnReconnectFailure: false
    }
  });

  newInstance.chainType = chainType;

  if (chainType === configStrategyConstants.gethChainType) {
    newInstance.extend({
      methods: [
        {
          name: 'pendingTransactions',
          call: 'txpool_content'
        }
      ]
    });
  } else {
    newInstance.extend({
      methods: [
        {
          name: 'pendingTransactions',
          call: 'parity_pendingTransactions'
        }
      ]
    });
  }

  web3InstanceMap[gethURL] = newInstance;

  return newInstance;
};

const instanceMap = {};

function getInstanceKey(fromAddress, chainType, chainId) {
  let args = Array.prototype.slice.call(arguments);
  return args.join('_');
}

function getInstance(instanceKey) {
  logger.log('NM :: getInstance :: instanceKey', instanceKey);
  return instanceMap[instanceKey];
}

function setInstance(instance, instanceKey) {
  if (instanceMap[instanceKey]) {
    logger.error('NM :: setInstance :: called when an instance already exists');
    return false;
  }

  instanceMap[instanceKey] = instance;
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
   * Get web3 instance for the given gethURL and chainType
   *
   * @param {string} gethURL - geth provider url
   * @param {string} chainType - chain kind e.g value, utility
   *
   * @return {promise<result>}
   */
  getWeb3Instance: function(gethURL, chainType) {
    return getWeb3Instance(gethURL, chainType);
  },

  getInstanceKey: function(fromAddress, chainType, chainId) {
    return getInstanceKey(fromAddress, chainType, chainId);
  },

  getInstance: function(instanceKey) {
    return getInstance(instanceKey);
  },

  setInstance: function(instance, instanceKey) {
    return setInstance(instance, instanceKey);
  },

  /**
   * Get mined transaction count for given address
   *
   * @param {string} chainType - chain kind e.g value, utility
   * @param {string} address - address whose nonce to be cleared
   * @param {array} gethProviders - list of geth providers.
   *
   * @return {promise<result>}
   */
  getMinedTransactionCount: function(chainType, address, gethProviders) {
    const oThis = this;

    try {
      const allNoncePromise = [],
        allGethNodes = gethProviders;
      for (let i = allGethNodes.length - 1; i >= 0; i--) {
        const gethURL = allGethNodes[i];

        const web3Provider = oThis.getWeb3Instance(gethURL, chainType);
        allNoncePromise.push(oThis.getNonceFromGethNode(address, web3Provider));
      }

      const allNoncePromiseResult = Promise.all(allNoncePromise);

      let isNonceAvailable = false;
      let nonceCount = 0;
      for (let i = allNoncePromiseResult.length - 1; i >= 0; i--) {
        const currentNonceResponse = allNoncePromiseResult[i];
        if (currentNonceResponse.isFailure()) {
          continue;
        }
        const currentNonce = new BigNumber(currentNonceResponse.data.mined_transaction_count);
        nonceCount = BigNumber.max(currentNonce, nonceCount);
        isNonceAvailable = true;
      }
      if (!isNonceAvailable) {
        return Promise.resolve(
          responseHelper.error({
            internal_error_identifier: 'mo_w_nh_getTransactionCount_1',
            api_error_identifier: 'unable_to_get_transaction_count',
            error_config: errorConfig
          })
        );
      }

      return Promise.resolve(responseHelper.successWithData({ nonce: nonceCount }));
    } catch (err) {
      //Format the error
      logger.error('module_overrides/web3_eth/nonce_helper.js:getTransactionCount inside catch ', err);
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'mo_w_nh_getTransactionCount_2',
          api_error_identifier: 'unable_to_get_transaction_count',
          error_config: errorConfig
        })
      );
    }
  },

  /**
   * Get all queued transactions
   *
   * @param {string} chainType - chain kind e.g value, utility
   * @param {array} gethProviders - list of geth providers.
   *
   * @return {promise<result>}
   */
  getAllQueuedTransaction: async function(chainType, gethProviders) {
    const oThis = this;

    try {
      const allTxPoolPromise = [],
        allGethNodes = gethProviders;

      for (let i = allGethNodes.length - 1; i >= 0; i--) {
        const gethURL = allGethNodes[i];
        const web3Provider = oThis.getWeb3Instance(gethURL, chainType);
        allTxPoolPromise.push(oThis.getPendingTransactionsFromGethNode(web3Provider));
      }

      const allTxPoolPromiseResult = await Promise.all(allTxPoolPromise);
      const queuedData = {};

      logger.debug('allTxPoolPromiseResult: ', allTxPoolPromiseResult);
      let isTransactionAvailable = false;

      for (let i = allTxPoolPromiseResult.length - 1; i >= 0; i--) {
        const currentTxPoolResponse = allTxPoolPromiseResult[i];
        if (currentTxPoolResponse.isFailure()) {
          continue;
        }

        const pendingTransaction = currentTxPoolResponse.data.pending_transaction.pending;
        const queuedTransaction = currentTxPoolResponse.data.pending_transaction.queued;

        for (let address in pendingTransaction) {
          queuedData[address] = queuedData[address] || {};
          Object.assign(queuedData[address], pendingTransaction[address]);
        }

        for (let address in queuedTransaction) {
          queuedData[address] = queuedData[address] || {};
          Object.assign(queuedData[address], queuedTransaction[address]);
        }
        isTransactionAvailable = true;
      }

      if (!isTransactionAvailable) {
        return Promise.resolve(
          responseHelper.error({
            internal_error_identifier: 'mo_w_nh_getAllQueuedTransaction_1',
            api_error_identifier: 'unable_to_get_queued_transaction',
            error_config: errorConfig
          })
        );
      }
      return Promise.resolve(responseHelper.successWithData({ queuedData: queuedData }));
    } catch (err) {
      //Format the error
      logger.error('module_overrides/web3_eth/nonce_helper.js:getAllQueuedTransaction inside catch ', err);
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'mo_w_nh_getAllQueuedTransaction_2',
          api_error_identifier: 'unable_to_get_queued_transaction',
          error_config: errorConfig
        })
      );
    }
  },

  /**
   * Clear all missing nonce
   *
   * @param {string} chainType - chain kind e.g value, utility
   * @param {object} scope - caller scope
   * @param {function} clearCallback - call back function that needs to be called when missing nonce is found
   * @param {array} gethProviders - list of geth providers.
   *
   * @return {promise<result>}
   */
  clearAllMissingNonce: async function(chainType, scope, clearCallback, gethProviders) {
    const oThis = this;

    try {
      const allQueuedTransaction = await oThis.getAllQueuedTransaction(chainType, gethProviders);
      if (allQueuedTransaction.isFailure()) {
        return Promise.resolve(
          responseHelper.error({
            internal_error_identifier: 'mo_w_nh_clearAllMissingNonce_1',
            api_error_identifier: 'unable_to_get_queued_transaction',
            error_config: errorConfig
          })
        );
      }
      let successAddresses = [],
        failAddresses = [];

      const queuedData = allQueuedTransaction.data.queuedData;
      for (let address in queuedData) {
        const clearResponce = await oThis.clearMissingNonce(
          address,
          chainType,
          queuedData[address],
          scope,
          clearCallback,
          gethProviders
        );
        if (clearResponce.isSuccess()) {
          successAddresses.push(address);
        } else {
          failAddresses.push(address);
        }
      }

      return Promise.resolve(
        responseHelper.successWithData({ successAddresses: successAddresses, failAddresses: failAddresses })
      );
    } catch (err) {
      //Format the error
      logger.error('module_overrides/web3_eth/nonce_helper.js:clearAllMissingNonce inside catch ', err);
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'mo_w_nh_clearAllMissingNonce_2',
          api_error_identifier: 'could_not_clear_missing_nonce',
          error_config: errorConfig
        })
      );
    }
  },

  /**
   * Clear all missing nonce for a given address
   *
   * @param {string} address - address whose nonce to be cleared
   * @param {string} chainType - chain kind e.g value, utility
   * @param {array} pendingTransactions - array of pending transaction
   * @param {object} scope - caller scope
   * @param {function} clearCallback - call back function that needs to be called when missing nonce is found
   * @param {array} gethProviders - list of geth providers.
   *
   * @return {promise<result>}
   */
  clearMissingNonce: async function(address, chainType, pendingTransactions, scope, clearCallback, gethProviders) {
    const oThis = this;

    if (!clearCallback) {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'mo_w_nh_clearMissingNonce_1',
          api_error_identifier: 'callback_function_is_mandatory',
          error_config: errorConfig
        })
      );
    }

    try {
      const allNoncePromise = [],
        allGethNodes = gethProviders;

      for (let i = allGethNodes.length - 1; i >= 0; i--) {
        const gethURL = allGethNodes[i];

        const web3Provider = oThis.getWeb3Instance(gethURL, chainType);
        allNoncePromise.push(oThis.getNonceFromGethNode(address, web3Provider));
      }

      const allNoncePromiseResult = await Promise.all(allNoncePromise);

      let nonceCount = 0;
      for (let i = allNoncePromiseResult.length - 1; i >= 0; i--) {
        const currentNonceResponse = allNoncePromiseResult[i];
        if (currentNonceResponse.isFailure()) {
          continue;
        }
        const currentNonce = new BigNumber(currentNonceResponse.data.mined_transaction_count);
        nonceCount = BigNumber.max(currentNonce, nonceCount);
      }

      const maxNonceCount = Math.max(...Object.keys(pendingTransactions));

      for (let nonce = nonceCount; nonce <= maxNonceCount; nonce++) {
        // fix  nonce code here
        const bgNonce = new BigNumber(nonce);
        const nonceString = `${bgNonce.toString(10)}`;
        if (!pendingTransactions[nonceString]) {
          clearCallback.apply(scope, [address, nonceString]);

          //clearCallback(address, nonceString);
        }
      }

      return Promise.resolve(responseHelper.successWithData({ address: address }));
    } catch (err) {
      //Format the error
      logger.error('module_overrides/web3_eth/nonce_helper.js:clearMissingNonce inside catch ', err);
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'mo_w_nh_clearMissingNonce_2',
          api_error_identifier: 'could_not_clear_missing_nonce',
          error_config: errorConfig
        })
      );
    }
  },

  /**
   * Get transactionCount
   * @param {string} address - address for which transaction count is to be fetched.
   * @param {object} web3Provider - web3 object
   *
   * @return {promise<result>}
   */
  getNonceFromGethNode: async function(address, web3Provider) {
    const oThis = this;

    return new Promise(function(onResolve, onReject) {
      try {
        web3Provider.eth.getTransactionCount(address, function(error, result) {
          if (error) {
            return onResolve(
              responseHelper.error({
                internal_error_identifier: 'mo_w_nh_getNonceFromGethNode_1',
                api_error_identifier: 'something_went_wrong',
                debug_options: { error: error },
                error_config: errorConfig
              })
            );
          } else {
            return onResolve(responseHelper.successWithData({ mined_transaction_count: result }));
          }
        });
      } catch (err) {
        //Format the error
        logger.error('module_overrides/web3_eth/nonce_helper.js:getNonceFromGethNode inside catch ', err);
        return onResolve(
          responseHelper.error({
            internal_error_identifier: 'mo_w_nh_getNonceFromGethNode_2',
            api_error_identifier: 'something_went_wrong',
            error_config: errorConfig
          })
        );
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
  getPendingTransactionsFromGethNode: async function(web3Provider) {
    const oThis = this;

    return new Promise(async function(onResolve, onReject) {
      try {
        const pendingTransaction = await web3Provider.pendingTransactions();

        logger.debug('pendingTransaction: ', pendingTransaction);
        if (pendingTransaction) {
          return onResolve(responseHelper.successWithData({ pending_transaction: pendingTransaction }));
        }
        return onResolve(
          responseHelper.error({
            internal_error_identifier: 'mo_w_nh_getPendingTransactionsFromGethNode_1',
            api_error_identifier: 'something_went_wrong',
            error_config: errorConfig
          })
        );
      } catch (err) {
        //Format the error
        logger.error('module_overrides/web3_eth/nonce_helper.js:getPendingTransactionsFromGethNode inside catch ', err);
        return onResolve(
          responseHelper.error({
            internal_error_identifier: 'mo_w_nh_getPendingTransactionsFromGethNode_2',
            api_error_identifier: 'something_went_wrong',
            error_config: errorConfig
          })
        );
      }
    });
  }
};

Object.assign(NonceHelperKlass.prototype, NonceHelperKlassPrototype);

module.exports = NonceHelperKlass;
