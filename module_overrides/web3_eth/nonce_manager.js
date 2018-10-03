'use strict';

const BigNumber = require('bignumber.js');

const rootPrefix = '../..',
  OpenStCache = require('@openstfoundation/openst-cache'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  SharedMemcachedProvider = require(rootPrefix + '/lib/providers/shared_memcached'),
  nonceHelperKlass = require(rootPrefix + '/module_overrides/web3_eth/nonce_helper'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  waitTimeout = 50000, //50 seconds
  waitTimeInterval = 2000; //2 second

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

  oThis.address = fromAddress;
  oThis.chainKind = chainKind;
  oThis.clientId = clientId;
  oThis.currentWsHost = currentWsHost;
  oThis.chainId = chainId;
  oThis.gethWsProviders = gethWsProviders;
  oThis.configStrategy = configStrategy;

  oThis.consistentBehavior = '0';
  oThis.lockingTtl = 5; // in seconds
  oThis.startTime = Date.now();
};

const NonceCacheKlassPrototype = {
  address: null,
  chainKind: null,
  clientId: null,
  currentWsHost: null,
  chainId: null,
  gethWsProviders: null,
  configStrategy: null,

  /**
   * Creates the cacheImplementer.
   *
   * @returns {Promise<never>}
   */
  deepInit: async function() {
    const oThis = this;

    if (oThis.clientId === '0') {
      // Create a shared memcached object for non-client specific memcached.
      let cacheObject = SharedMemcachedProvider.getInstance(oThis.consistentBehavior);
      oThis.cacheImplementer = cacheObject.cacheInstance;
    } else {
      // Create cache object for a client.
      let cacheConfigStrategy = {
        OST_CACHING_ENGINE: cacheManagementConst.memcached,
        OST_MEMCACHE_SERVERS: oThis.configStrategy.OST_NONCE_MEMCACHE_SERVERS,
        OST_DEFAULT_TTL: oThis.configStrategy.OST_DEFAULT_TTL,
        OST_CACHE_CONSISTENT_BEHAVIOR: '0'
      };

      let cacheObject = OpenStCache.getInstance(cacheConfigStrategy);
      oThis.cacheImplementer = cacheObject.cacheInstance;
    }

    // Set cache key for nonce
    oThis.cacheKey = `nonce_${oThis.chainKind}_${oThis.chainId}_${oThis.address}`;
    logger.debug('NM :: NonceManagerKlass :: oThis.cacheKey: ', oThis.cacheKey);

    // Set cache key for nonce lock
    oThis.cacheLockKey = `nonce_${oThis.chainKind}_${oThis.chainId}_${oThis.address}_lock`;
    logger.debug('NM :: NonceManagerKlass :: oThis.cacheLockKey: ', oThis.cacheLockKey);
  },

  /**
   * Get nonce. This gets the nonce from cache then increments and returns. If not in cache it gets from chain
   *
   * @return {promise<result>}
   */
  getNonce: async function(customOnResolve, customOnReject) {
    const oThis = this;

    let promiseObj;

    if (!customOnResolve || !customOnReject) {
      promiseObj = new Promise(async function(onResolve, onReject) {
        customOnReject = onReject;
        customOnResolve = onResolve;
      });
    } else {
      promiseObj = new Promise(async function(customOnResolve, customOnReject) {});
    }

    if (!oThis.cacheImplementer) {
      await oThis.deepInit();
    }

    let fetchIncrementedNonceRsp = await oThis._incrementNonce(),
      nonce = fetchIncrementedNonceRsp.data.response;

    if (fetchIncrementedNonceRsp.isSuccess() && nonce != null) {
      logger.debug(
        'NM :: getNonce :: nonceReceived: ',
        `chainKind_${oThis.chainKind}_chainId_${oThis.chainId}_addr_${oThis.address}_nonce_${nonce}`
      );
      customOnResolve(responseHelper.successWithData({ nonce: parseInt(nonce) }));
    } else {
      oThis._acquireLockAndSyncNonceFromGeth(customOnResolve, customOnReject);
    }

    return promiseObj;
  },

  /**
   * 1. Acquire the lock
   * 2. Fetch nonce from Geth
   * 3. Set it in cache
   * 4. release lock
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _acquireLockAndSyncNonceFromGeth: async function(onResolve, onReject) {
    const oThis = this;

    const acquireLockAndReturnNonce = async function() {
      const acquireLockResponse = await oThis._acquireLock();

      if (acquireLockResponse.isSuccess()) {
        let syncNonceResp = await oThis._getNonceFromGethAndSetCache();
        if (syncNonceResp.isSuccess()) {
          logger.debug(
            'NM :: getNonce :: syncNonceReturned: ',
            `chainKind_${oThis.chainKind}_chain_${oThis.chainId}_addr_${oThis.address}_nonce_${
              syncNonceResp.data.nonce
            }`
          );
        }
        await oThis._releaseLock();
        return syncNonceResp;
      } else {
        return acquireLockResponse;
      }
    };

    const wait = function() {
      try {
        //Check for timeout.
        if (_getTimeStamp() - oThis.startTime > waitTimeout) {
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
        acquireLockAndReturnNonce()
          .catch(function(reason) {
            logger.error('NM :: acquireLockAndReturn rejected the Promise. reason :: ', reason);
            return responseHelper.error({
              internal_error_identifier: 'l_nm_aqLockCatch_1',
              api_error_identifier: 'internal_server_error',
              error_config: errorConfig
            });
          })
          .then(function(response) {
            const acquireLockResponseData = response.toHash();
            if (response.isSuccess()) {
              //We got the lock.
              return onResolve(response);
            } else if (
              acquireLockResponseData.err &&
              acquireLockResponseData.err.internal_id &&
              String(acquireLockResponseData.err.internal_id).indexOf('l_nm_aqLockCatch_1') >= 0
            ) {
              //Safety-Net. acquireLockAndReturn reject the Promise.
              return onResolve(response);
            } else {
              //Lets try again to aquire lock.
              logger.debug(
                'NM :: getNonce :: lockIsAcquiredBySomeBody : ',
                `chainKind_${oThis.chainKind}_chain_${oThis.chainId}_addr_${oThis.address}`
              );
              setTimeout(function() {
                oThis.getNonce(onResolve, onReject);
              }, waitTimeInterval);
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

  completionWithFailure: async function(shouldSyncNonce) {
    const oThis = this;

    // oThis.completionFailureCnt++;

    logger.error('NM :: completionWithFailure called with shouldSyncNonce: ', shouldSyncNonce);

    if (shouldSyncNonce) {
      await oThis._acquireLockAndSyncNonceFromGeth();
    }

    return responseHelper.successWithData({});
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

    const lockResponse = await oThis.cacheImplementer.acquireLock(oThis.cacheLockKey, oThis.lockingTtl);

    if (lockResponse.isFailure()) {
      return responseHelper.error({
        internal_error_identifier: 'l_nm_acquireLock_fail_2',
        api_error_identifier: 'acquire_lock_failed',
        debug_options: { msg: 'Error in acquiring lock.' },
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
    return oThis.cacheImplementer.releaseLock(oThis.cacheLockKey);
  },

  /**
   * increment nonce
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _incrementNonce: async function() {
    const oThis = this;
    return oThis.cacheImplementer.increment(oThis.cacheKey);
  },

  /**
   * decrement nonce
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _decrementNonce: async function() {
    const oThis = this;
    return oThis.cacheImplementer.decrement(oThis.cacheKey);
  },

  /**
   * 1. Fetch nonce from all the geth nodes
   * 2. set nonce in cache
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _getNonceFromGethAndSetCache: async function() {
    const oThis = this,
      getMinedTxCountPromises = [],
      getPendingTxnsPromises = [];

    for (let i = oThis.gethWsProviders.length - 1; i >= 0; i--) {
      const gethURL = oThis.gethWsProviders[i];

      const web3Provider = oThis.nonceHelper.getWeb3Instance(gethURL, oThis.chainKind);
      getMinedTxCountPromises.push(oThis.nonceHelper.getMinedTxCountFromGeth(oThis.address, web3Provider));
      getPendingTxnsPromises.push(oThis.nonceHelper.getUnminedTransactionsFromGethNode(web3Provider));
    }

    let cumulativePromiseResponses = await Promise.all([
      Promise.all(getMinedTxCountPromises),
      Promise.all(getPendingTxnsPromises)
    ]);
    const getMinedTxCountResults = cumulativePromiseResponses[0];
    const pendingTxnsResults = cumulativePromiseResponses[1];

    let maxNonceCount = new BigNumber(0),
      isNonceCountAvailable = false,
      unminedTxNonces = [];

    // check nonce count from pending transactions
    for (let i = pendingTxnsResults.length - 1; i >= 0; i--) {
      const currentPendingTransactionResponse = pendingTxnsResults[i];
      if (currentPendingTransactionResponse.isFailure()) {
        continue;
      }

      const unminedTransactions = currentPendingTransactionResponse.data.unmined_transactions;

      if (unminedTransactions) {
        unminedTxNonces = unminedTxNonces.concat(oThis.getNoncesOfUnminedTxs(unminedTransactions.pending));
        unminedTxNonces = unminedTxNonces.concat(oThis.getNoncesOfUnminedTxs(unminedTransactions.queued));
      }
    }

    // check nonce count from mined transactions
    for (let i = getMinedTxCountResults.length - 1; i >= 0; i--) {
      const currentNonceResponse = getMinedTxCountResults[i];
      if (currentNonceResponse.isFailure()) {
        continue;
      }

      isNonceCountAvailable = true;
      const currentNonce = new BigNumber(currentNonceResponse.data.mined_transaction_count);
      maxNonceCount = BigNumber.max(currentNonce, maxNonceCount);
    }

    if (isNonceCountAvailable || unminedTxNonces.length > 0) {
      if (unminedTxNonces.length > 0) {
        for (let i = unminedTxNonces.length - 1; i >= 0; i--) {
          const unminedNonceCount = new BigNumber(unminedTxNonces[i]);
          maxNonceCount = BigNumber.max(unminedNonceCount.plus(1), maxNonceCount);
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
  },

  /**
   * get the nounce count from all pending transations
   *
   * @param pendingTransactions {object} : data of unminedTransactions
   * @return {promise<result>}
   * @private
   * @ignore
   */
  getNoncesOfUnminedTxs: function(pendingTransactions) {
    const oThis = this;
    let allNonce = [];
    for (let key in pendingTransactions) {
      if (key.toLowerCase() === oThis.address) {
        allNonce = allNonce.concat(oThis.getNonceFromUnminedTransaction(pendingTransactions[key]));
      }
    }
    return allNonce;
  },

  /**
   * Get the nonce count from the transaction objects from a given address
   *
   * @param unminedTransactions {object} : data of unminedTransactions from an address
   * @return {promise<result>}
   * @private
   * @ignore
   */
  getNonceFromUnminedTransaction: function(unminedTransactions) {
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
  }
};

Object.assign(NonceManagerKlass.prototype, NonceCacheKlassPrototype);

module.exports = NonceManagerKlass;
