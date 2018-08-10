'use strict';

const BigNumber = require('bignumber.js');

const rootPrefix = '../..',
  OpenStCache = require('@openstfoundation/openst-cache'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  SharedRedisProvider = require(rootPrefix + '/lib/providers/shared_redis'),
  nonceHelperKlass = require(rootPrefix + '/module_overrides/web3_eth/nonce_helper'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  waitTimeout = 50000, //50 seconds
  waitTimeInterval = 5; //5 milliseconds

/**
 * Utility function to get timestamp
 *
 * @return {number}
 * @private
 * @ignore
 */
function _getTimeStamp() {
  return !Date.now ? +new Date() : Date.now();
}

/**
 * @constructor
 *
 * @param {Object} params - cache key address, chain_kind
 *
 */
const NonceManagerKlass = function(params) {
  const oThis = this,
    fromAddress = params['address'].toLowerCase(),
    chainKind = params['chain_kind'],
    clientId = params['client_id'],
    currentWsHost = params['host'],
    chainId = params['chain_id'],
    gethWsProviders = params['geth_providers'],
    configStrategy = params['config_strategy'];
  // gethWsProviders being fetched are the ones that need to be used directly.

  oThis.nonceHelper = new nonceHelperKlass();

  //Check for existing instance
  let instanceKey = oThis.nonceHelper.getInstanceKey(fromAddress, chainKind),
    existingInstance = oThis.nonceHelper.getInstance(instanceKey);
  if (existingInstance) {
    logger.log('NM :: NonceManagerKlass :: existingInstance FOUND!');
    return existingInstance;
  } else {
    oThis.nonceHelper.setInstance(oThis, instanceKey);
  }

  logger.log('NM :: NonceManagerKlass :: creating new instance');

  oThis.address = fromAddress;
  oThis.chainKind = chainKind;
  oThis.clientId = clientId;
  oThis.currentWsHost = currentWsHost;
  oThis.chainId = chainId;
  oThis.gethWsProviders = gethWsProviders;
  oThis.configStrategy = configStrategy;
  oThis.promiseQueue = [];
  oThis.processedQueue = [];
  oThis.consistentBehavior = '0';
};

const NonceCacheKlassPrototype = {
  address: null,
  chainKind: null,
  promiseQueue: null,

  /**
   * Creates the cacheImplementer.
   *
   * @returns {Promise<never>}
   */
  deepInit: async function() {
    const oThis = this;

    // Create a shared redis object for non-client specific redis.
    if (oThis.clientId === '0') {
      let cacheObject = SharedRedisProvider.getInstance(oThis.consistentBehavior);
      oThis.cacheImplementer = cacheObject.cacheInstance;
    }
    // Create cache object for a client.
    else {
      let cacheConfigStrategy = {
        OST_CACHING_ENGINE: cacheManagementConst.redis,
        OST_REDIS_HOST: oThis.configStrategy.OST_REDIS_HOST,
        OST_REDIS_PORT: oThis.configStrategy.OST_REDIS_PORT,
        OST_REDIS_PASS: oThis.configStrategy.OST_REDIS_PASS,
        OST_REDIS_TLS_ENABLED: oThis.configStrategy.OST_REDIS_TLS_ENABLED,
        OST_DEFAULT_TTL: oThis.configStrategy.OST_DEFAULT_TTL,
        OST_CACHE_CONSISTENT_BEHAVIOR: '0'
      };

      let cacheObject = OpenStCache.getInstance(cacheConfigStrategy);
      oThis.cacheImplementer = cacheObject.cacheInstance;

      if (oThis.chainKind === 'value') {
        oThis.chainId = oThis.configStrategy.OST_VALUE_CHAIN_ID;
      } else {
        oThis.chainId = oThis.configStrategy.OST_UTILITY_CHAIN_ID;
      }
    }

    // Set cache key for nonce
    oThis.cacheKey = `nonce_${oThis.chainKind}_${oThis.address}_${oThis.chainId}`;
    logger.log('NM :: NonceManagerKlass :: oThis.cacheKey: ', oThis.cacheKey);
    // Set cache key for nonce lock
    oThis.cacheLockKey = `nonce_${oThis.chainKind}_${oThis.address}_${oThis.chainId}_lock`;
  },

  /**
   * Query if the lock is acquired for the given nonce key
   *
   * @return {boolean}
   */
  isLocked: async function() {
    const oThis = this;

    if (!oThis.cacheImplementer) {
      await oThis.deepInit();
    }

    const lockStatusResponse = await oThis.cacheImplementer.get(oThis.cacheLockKey);

    return lockStatusResponse.isSuccess() && lockStatusResponse.data.response > 0;
  },

  /**
   * Get nonce. This gets the nonce from cache then increments and returns. If not in cache it gets from chain
   *
   * @return {promise<result>}
   */
  getNonce: function() {
    const oThis = this,
      queueTimeStamp = _getTimeStamp(),
      promiseContext = {
        startTimestamp: queueTimeStamp,
        nonce: -1,
        promiseObj: null,
        resolve: null,
        reject: null,
        promiseAction: 'QUEUED'
      },
      promiseObj = new Promise(function(resolve, reject) {
        promiseContext.resolve = resolve;
        promiseContext.reject = reject;
      });

    logger.log('NM :: getNonce called.');

    promiseContext.promiseObj = promiseObj;

    oThis.promiseQueue.push(promiseContext);
    oThis.processNext();

    return promiseObj;
  },

  isProcessing: false,

  processNext: async function() {
    const oThis = this;

    if (!oThis.cacheImplementer) {
      await oThis.deepInit();
    }

    if (oThis.isProcessing) {
      return;
    }

    if (oThis.promiseQueue.length === 0) {
      return;
    }

    oThis.isProcessing = true;

    const promiseContext = oThis.promiseQueue[0];

    const onResolve = function(result) {
      const unshiftedContext = oThis.promiseQueue.shift();
      oThis.processedQueue.push(unshiftedContext);

      if (promiseContext == unshiftedContext) {
        logger.log('NM :: onResolve :: Correct context removed.');
      } else {
        logger.error('NM :: onResolve :: Could not find promise context.');
      }

      setTimeout(function() {
        oThis.isProcessing = false;
        oThis.processNext();
      }, 1);

      promiseContext.nonce = result.success ? result.data.nonce : '---FAILED---';
      promiseContext.promiseAction = 'RESOLVED';
      let resolve = promiseContext.resolve;
      try {
        resolve(result);
      } catch (e) {
        logger.error('NM :: processNext :: onResolve :: promise resolve threw an exception. Error: ', e);
        logger.trace('NM :: processNext :: onResolve :: promise resolve threw an exception.');
      }
    };

    const onReject = function(reason) {
      const unshiftedContext = oThis.promiseQueue.shift();
      oThis.processedQueue.push(unshiftedContext);

      if (promiseContext == unshiftedContext) {
        logger.log('NM :: onReject :: Correct context removed');
      } else {
        logger.error('NM :: onReject :: IMPORTANT :: promiseQueue is out of sync.');
      }

      setTimeout(function() {
        oThis.isProcessing = false;
        oThis.processNext();
      }, 1);

      let reject = promiseContext.reject;
      promiseContext.promiseAction = 'REJECTED';
      reject(reason);
    };

    const acquireLockAndReturn = async function() {
      const acquireLockResponse = await oThis._acquireLock();

      if (acquireLockResponse.isSuccess()) {
        const nonceResponse = await oThis.cacheImplementer.get(oThis.cacheKey);
        if (nonceResponse.isSuccess() && nonceResponse.data.response != null) {
          logger.log('NM :: acquireLockAndReturn :: nonceResponse: ', nonceResponse);
          return responseHelper.successWithData({ nonce: parseInt(nonceResponse.data.response) });
        } else {
          return await oThis._syncNonce();
        }
      } else {
        return acquireLockResponse;
      }
    };

    const startTime = promiseContext.startTimestamp;

    const wait = function() {
      try {
        //Check for timeout.
        if (_getTimeStamp() - startTime > waitTimeout) {
          //Format the error
          logger.error('NM :: wait :: promise has timed out');
          let errorResult = responseHelper.error({
            internal_error_identifier: 'l_nm_getNonce_1',
            api_error_identifier: 'internal_server_error',
            debug_options: { timedOut: true },
            error_config: errorConfig
          });
          return onResolve(errorResult);
        }

        //Try to acquire lock directly.
        acquireLockAndReturn()
          .catch(function(reason) {
            logger.error('NM :: acquireLockAndReturn rejected the Promise. reason :: ', reason);
            return responseHelper.error({
              internal_error_identifier: 'l_nm_aqLockCatch_1',
              api_error_identifier: 'internal_server_error',
              error_config: errorConfig
            });
          })
          .then(function(acquireLockResponse) {
            const acquireLockResponseData = acquireLockResponse.toHash();
            if (acquireLockResponse.isSuccess()) {
              //We got the lock.
              return onResolve(acquireLockResponse);
            } else if (
              acquireLockResponseData.err &&
              acquireLockResponseData.err.code &&
              String(acquireLockResponseData.err.code).indexOf('l_nm_aqLockCatch_1') >= 0
            ) {
              //Safety-Net. acquireLockAndReturn reject the Promise.
              return onResolve(acquireLockResponse);
            } else {
              //Lets try again to aquire lock.
              setTimeout(wait, waitTimeInterval);
            }
          });
      } catch (err) {
        //Format the error
        logger.error('NM :: IMPORTANT :: wait inside catch ', err);
        return onResolve(
          responseHelper.error({
            internal_error_identifier: 'l_nm_getNonce_2',
            api_error_identifier: 'internal_server_error',
            error_config: errorConfig
          })
        );
      }
    };

    try {
      return wait();
    } catch (err) {
      //Format the error
      logger.error('NM :: IMPORTANT :: processNext inside catch ', err);
      return onResolve(
        responseHelper.error({
          internal_error_identifier: 'l_nm_getNonce_3',
          api_error_identifier: 'internal_server_error',
          error_config: errorConfig
        })
      );
    }
  },

  /**
   * completion call back when successfull, this will release the lock
   *
   * @return {promise<result>}
   */
  completionSuccessCnt: 0,

  completionWithSuccess: async function() {
    const oThis = this;

    oThis.completionSuccessCnt++;
    logger.log('NM :: completionWithSuccess');
    await oThis._increment();
    return await oThis._releaseLock();
  },

  /**
   * completion call back when failure.
   *
   * @param {boolean} shouldSyncNonce - flag if nonce need to be synced with nodes
   *
   * @return {promise<result>}
   */
  completionFailureCnt: 0,

  completionWithFailure: async function(shouldSyncNonce) {
    const oThis = this;

    oThis.completionFailureCnt++;
    logger.log('NM :: completionWithFailure');
    if (shouldSyncNonce) {
      await oThis._syncNonce();
    }

    return await oThis._releaseLock();
  },

  /**
   * Abort the process.
   *
   * @return {promise<result>}
   */
  abort: async function() {
    const oThis = this;

    return await oThis._releaseLock();
  },

  /**
   * Acquire the lock the nonce usage for the address
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _acquireLock: async function() {
    const oThis = this;

    if (!oThis.cacheImplementer) {
      await oThis.deepInit();
    }

    // check if already locked
    const isLocked = await oThis.isLocked();
    if (isLocked) {
      return responseHelper.error({
        internal_error_identifier: 'l_nm_acquireLock_fail_1',
        api_error_identifier: 'internal_server_error',
        debug_options: { msg: 'Lock is already given to some other process. Waiting for lock release.' },
        error_config: errorConfig
      });
    }

    const lockResponse = await oThis.cacheImplementer.increment(oThis.cacheLockKey);
    if (lockResponse.isFailure()) {
      return responseHelper.error({
        internal_error_identifier: 'l_nm_acquireLock_fail_2',
        api_error_identifier: 'internal_server_error',
        debug_options: { msg: 'Error in acquiring lock using cache increment.' },
        error_config: errorConfig
      });
    }

    // lock was not given to current request
    if (lockResponse.data.response != 1) {
      // Revert the increased lock if value is not 1.
      // Means someone else has acquired the lock already.
      await oThis.cacheImplementer.decrement(oThis.cacheLockKey);
      return responseHelper.error({
        internal_error_identifier: 'l_nm_acquireLock_fail_3',
        api_error_identifier: 'internal_server_error',
        debug_options: { msg: 'Lock is already given to some other process. Waiting for lock release.' },
        error_config: errorConfig
      });
    }

    return responseHelper.successWithData({});
  },

  /**
   * Release the lock for nonce usage for the address
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _releaseLock: async function() {
    const oThis = this;

    if (!oThis.cacheImplementer) {
      await oThis.deepInit();
    }

    return oThis.cacheImplementer.decrement(oThis.cacheLockKey);
  },

  /**
   * increment nonce
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _increment: async function() {
    const oThis = this;

    if (!oThis.cacheImplementer) {
      await oThis.deepInit();
    }

    return oThis.cacheImplementer.increment(oThis.cacheKey);
  },

  /**
   * decrement nonce
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _decrement: async function() {
    const oThis = this;

    if (!oThis.cacheImplementer) {
      await oThis.deepInit();
    }

    return oThis.cacheImplementer.decrement(oThis.cacheKey);
  },

  /**
   * Sync nonce from all the geth nodes
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _syncNonce: async function() {
    const oThis = this,
      allNoncePromise = [],
      allPendingTransactionPromise = [];

    if (!oThis.cacheImplementer) {
      await oThis.deepInit();
    }

    for (let i = oThis.gethWsProviders.length - 1; i >= 0; i--) {
      const gethURL = oThis.gethWsProviders[i];

      const web3Provider = oThis.nonceHelper.getWeb3Instance(gethURL, oThis.chain_kind);
      allNoncePromise.push(oThis.nonceHelper.getNonceFromGethNode(oThis.address, web3Provider));
      allPendingTransactionPromise.push(oThis.nonceHelper.getPendingTransactionsFromGethNode(web3Provider));
    }

    let x = await Promise.all([Promise.all(allNoncePromise), Promise.all(allPendingTransactionPromise)]);
    const allNoncePromiseResult = x[0];
    const allPendingTransactionPromiseResult = x[1];

    let maxNonceCount = new BigNumber(0),
      isNonceCountAvailable = false,
      allPendingNonce = [];

    // Get the nonce count from the transaction object
    const getNonceFromUnminedTransaction = function(unminedTransactions) {
      const allNonce = [];
      if (unminedTransactions) {
        for (let nonceKey in unminedTransactions) {
          const transactionObj = unminedTransactions[nonceKey];
          if (transactionObj.nonce) {
            allNonce.push(new BigNumber(transactionObj.nonce));
          }
        }
      }
      return allNonce;
    };

    // get the nounce count from pending transations
    const getPendingNonce = function(pendingTransactions) {
      let allNonce = [];
      for (let key in pendingTransactions) {
        if (key.toLowerCase() === oThis.address) {
          allNonce = allNonce.concat(getNonceFromUnminedTransaction(pendingTransactions[key]));
        }
      }
      return allNonce;
    };

    // check nonce count from pending transactions
    for (let i = allPendingTransactionPromiseResult.length - 1; i >= 0; i--) {
      const currentPendingTransactionResponse = allPendingTransactionPromiseResult[i];
      if (currentPendingTransactionResponse.isFailure()) {
        continue;
      }

      const pendingTransaction = currentPendingTransactionResponse.data.pending_transaction;

      if (pendingTransaction) {
        allPendingNonce = allPendingNonce.concat(getPendingNonce(pendingTransaction.pending));
        allPendingNonce = allPendingNonce.concat(getPendingNonce(pendingTransaction.queued));
      }
    }

    // check nonce count from mined transactions
    for (let i = allNoncePromiseResult.length - 1; i >= 0; i--) {
      const currentNonceResponse = allNoncePromiseResult[i];
      if (currentNonceResponse.isFailure()) {
        continue;
      }

      isNonceCountAvailable = true;
      const currentNonce = new BigNumber(currentNonceResponse.data.mined_transaction_count);
      maxNonceCount = BigNumber.max(currentNonce, maxNonceCount);
    }

    if (isNonceCountAvailable || allPendingNonce.length > 0) {
      if (allPendingNonce.length > 0) {
        for (let i = allPendingNonce.length - 1; i >= 0; i--) {
          const pendingNonceCount = new BigNumber(allPendingNonce[i]);
          maxNonceCount = BigNumber.max(pendingNonceCount.plus(1), maxNonceCount);
        }
      }
      const setNonceResponse = await oThis.cacheImplementer.set(oThis.cacheKey, maxNonceCount.toNumber());
      logger.log('NM :: maxNonceCount: ', maxNonceCount.toNumber());
      if (setNonceResponse.isSuccess()) {
        return Promise.resolve(responseHelper.successWithData({ nonce: maxNonceCount.toNumber() }));
      }
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'l_nm_syncNonce_fail_1',
          api_error_identifier: 'internal_server_error',
          debug_options: { msg: 'unable to set nonce in cache.' },
          error_config: errorConfig
        })
      );
    } else {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'l_nm_syncNonce_fail_2',
          api_error_identifier: 'internal_server_error',
          debug_options: { msg: 'unable to fetch nonce from geth nodes.' },
          error_config: errorConfig
        })
      );
    }
  }
};

Object.assign(NonceManagerKlass.prototype, NonceCacheKlassPrototype);

module.exports = NonceManagerKlass;
