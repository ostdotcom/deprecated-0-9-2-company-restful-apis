"use strict";

const BigNumber = require('bignumber.js')
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , cacheImplementer = require(rootPrefix + '/lib/cache_management/balance_and_nonce_cache_engine')
  , nonceHelperKlass = require(rootPrefix + '/module_overrides/web3_eth/nonce_helper')
  , waitTimeout = 50000 //50 seconds
  , waitTimeInterval = 5 //5 milliseconds
;


/**
 * Utility function to get timestamp
 *
 * @return {number}
 * @private
 * @ignore
 */
function _getTimeStamp() {
  return  (!Date.now ? +new Date() : Date.now());
}

/**
 * @constructor
 *
 * @param {Object} params - cache key address, chain_kind
 *
 */
const NonceManagerKlass = function(params) {

  const oThis = this
      , fromAddress   = params['address'].toLowerCase()
      , chainKind     = params['chain_kind']
  ;

  oThis.nonceHelper = new nonceHelperKlass();
  //Throw Here.

  //Check for existing instance
  var instanceKey = oThis.nonceHelper.getInstanceKey( fromAddress, chainKind )
    , existingInstance = oThis.nonceHelper.getInstance( instanceKey )
  ;
  if ( existingInstance ) {
    console.log("existingInstance FOUND!");
    return existingInstance;
  } else {
    oThis.nonceHelper.setInstance(oThis, instanceKey);
  }

  console.log("creating new instance");

  oThis.address = fromAddress;
  oThis.chainKind = chainKind;
  oThis.promiseQueue = [];
  oThis.processedQueue = [];

  // Set cacheImplementer to perform caching operations
  oThis.cacheImplementer = cacheImplementer;

  // Set cache key for nonce
  oThis.cacheKey = `nonce_${oThis.chainKind}_${oThis.address}`;
  console.log("oThis.cacheKey: ",oThis.cacheKey);
  // Set cache key for nonce lock
  oThis.cacheLockKey = `nonce_${oThis.chainKind}_${oThis.address}_lock`;
};

const NonceCacheKlassPrototype = {

  address: null,
  chainKind: null,
  promiseQueue: null,

  /**
   * Query if the lock is acquired for the given nonce key
   *
   * @return {boolean}
   */
  isLocked: async function() {
    const oThis = this
      , lockStatusResponse = await oThis.cacheImplementer.get(oThis.cacheLockKey)
    ;

    return lockStatusResponse.isSuccess() && lockStatusResponse.data.response > 0;

  },

  /**
   * Get nonce. This gets the nonce from cache then increments and returns. If not in cache it gets from chain
   *
   * @return {promise<result>}
   */
  getNonce: function() {
    const oThis = this
      , queueTimeStamp = _getTimeStamp()
      , promiseContext = {
        startTimestamp: queueTimeStamp,
        nonce: -1,
        promiseObj: null,
        resolve: null,
        reject: null,
        promiseAction: "QUEUED"
      }
      , promiseObj = new Promise( function (resolve, reject) {
        promiseContext.resolve = resolve;
        promiseContext.reject = reject;
      })

    ;

    console.log("getNonce called");

    promiseContext.promiseObj = promiseObj;

    oThis.promiseQueue.push( promiseContext );
    oThis.processNext();

    return promiseObj;
  },

  isProcessing: false,
  processNext: async function () {
    const oThis = this
    ;

    if ( oThis.isProcessing ) {
      return;
    }

    if ( oThis.promiseQueue.length == 0 ) {
      return;
    }

    oThis.isProcessing = true;

    const promiseContext = oThis.promiseQueue[ 0 ]
    ;

    const onResolve = function ( result ) {
      const unshiftedContext = oThis.promiseQueue.shift();
      oThis.processedQueue.push( unshiftedContext );

      if ( promiseContext == unshiftedContext ) {
        console.log("Correct context removed");
      } else {
        console.log("We PLEASE FIND ME....... IMPORTANT");
      }

      setTimeout(function () {
        oThis.isProcessing = false;
        oThis.processNext();
      }, 1);

      promiseContext.nonce = result.success ? result.data.nonce : "---FAILED---";
      promiseContext.promiseAction = "RESOLVED";
      var resolve = promiseContext.resolve;
      resolve( result );
    };

    const onReject = function ( reason ) {
      const unshiftedContext = oThis.promiseQueue.shift();
      oThis.processedQueue.push( unshiftedContext );

      if ( promiseContext == unshiftedContext ) {
        console.log("Correct context removed");
      } else {
        console.log("We PLEASE FIND ME....... IMPORTANT");
      }

      setTimeout(function () {
        oThis.isProcessing = false;
        oThis.processNext();
      }, 1);

      var reject = promiseContext.reject;
      promiseContext.promiseAction = "REJECTED";
      reject( reason );
    };

    const acquireLockAndReturn = async function () {
      const acquireLockResponse = await oThis._acquireLock();
      if (acquireLockResponse.isSuccess()) {
        const nonceResponse = await oThis.cacheImplementer.get(oThis.cacheKey);
        if (nonceResponse.isSuccess() && nonceResponse.data.response != null) {
          console.log("nonceResponse: ", nonceResponse);
          return responseHelper.successWithData({nonce: parseInt(nonceResponse.data.response)});
        } else {
          return await oThis._syncNonce();
        }
      } else {
        return acquireLockResponse;
      }
    };


    const startTime =  promiseContext.startTimestamp;
    const wait = async function() {
      try {
        if (_getTimeStamp()-startTime > waitTimeout) {
          //Format the error
          logger.error("module_overrides/web3_eth/nonce_manager.js:getNonce:wait");
          return onResolve(responseHelper.error('l_nm_getNonce_1', 'getNonce timeout'));
        }
        const isLocked = await oThis.isLocked();
        if (isLocked) {
          setTimeout(wait, waitTimeInterval);
        } else {
          //return onResolve(acquireLockAndReturn());
          const acquireLockResponse = await acquireLockAndReturn();
          if (acquireLockResponse.isSuccess()) {
            return onResolve(acquireLockResponse);
          }else{
            wait();
          }
        }
      } catch (err) {
        //Format the error
        logger.error("module_overrides/web3_eth/nonce_manager.js:getNonce:wait inside catch ", err);
        return onResolve(responseHelper.error('l_nm_getNonce_2', 'Something went wrong'));
      }
    };

    try {
      // if the lock is aquired then wait for unlock
      // if the lock is not aquired then lock the nonce key for usage and return the nonce count
      const isLocked = await oThis.isLocked();
      if (!isLocked) {
        const acquireLockResponse = await acquireLockAndReturn();
        if (acquireLockResponse.isSuccess()) {
          return onResolve(acquireLockResponse);
        }else{
          wait();
        }

      } else {
        // the key is already locked. Now wait for it to get unlocked.
        return wait();
      }
    } catch (err) {
      //Format the error
      logger.error("module_overrides/web3_eth/nonce_manager.js:getNonce inside catch ", err);
      return onResolve(responseHelper.error('l_nm_getNonce_3', 'Something went wrong'));
    }


  },

  /**
   * completion call back when successfull, this will release the lock
   *
   * @return {promise<result>}
   */
  completionSuccessCnt:0,
  completionWithSuccess: async function() {
    const oThis = this
    ;

    oThis.completionSuccessCnt ++;
    console.log("completionWithSuccess");
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
  completionFailureCnt:0,
  completionWithFailure: async function(shouldSyncNonce) {
    const oThis = this
    ;

    oThis.completionFailureCnt ++;
    console.log("completionWithFailure");
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
    const oThis = this
    ;

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
    const oThis = this
      , lockResponse = await oThis.cacheImplementer.increment(oThis.cacheLockKey)
    ;
    console.log("oThis.cacheLockKey: ",oThis.cacheLockKey);
    if (lockResponse.isSuccess()) {
      // Response should be 1 to call it acquired.
      if (lockResponse.data.response == 1) {
        return Promise.resolve(responseHelper.successWithData({}));
      }
      // Revert the increased lock if value is not 1.
      // Means someone else has acquired the lock already.
      await oThis.cacheImplementer.decrement(oThis.cacheLockKey);
    }
    return Promise.resolve(responseHelper.error("l_nm_acquireLock_1", "unable to acquire lock"));

  },

  /**
   * Release the lock for nonce usage for the address
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _releaseLock: function() {
    const oThis = this
    ;

    return oThis.cacheImplementer.decrement(oThis.cacheLockKey);

  },

  /**
   * increment nonce
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _increment: function(){
    const oThis = this
    ;

    return oThis.cacheImplementer.increment(oThis.cacheKey);

  },

  /**
   * decrement nonce
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _decrement: function(){
    const oThis = this
    ;

    return oThis.cacheImplementer.decrement(oThis.cacheKey);

  },

  /**
   * Sync nonce from all the geth nodes
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _syncNonce: async function(){
    const oThis = this
      , allNoncePromise = []
      , allPendingTransactionPromise = []
      , allGethNodes = (oThis.chainKind == 'value') ? chainInteractionConstants.OST_VALUE_GETH_RPC_PROVIDERS :
        chainInteractionConstants.OST_UTILITY_GETH_RPC_PROVIDERS
    ;

    for (var i = allGethNodes.length - 1; i >= 0; i--) {
      const gethURL = allGethNodes[i];

      const web3UtilityRpcProvider = oThis.nonceHelper.getWeb3Instance(gethURL, oThis.chain_kind);
      allNoncePromise.push(oThis.nonceHelper.getNonceFromGethNode(oThis.address, web3UtilityRpcProvider));
      allPendingTransactionPromise.push(oThis.nonceHelper.getPendingTransactionsFromGethNode(web3UtilityRpcProvider));
    }

    var x = await Promise.all([Promise.all(allNoncePromise), Promise.all(allPendingTransactionPromise)]);
    const allNoncePromiseResult = x[0];
    const allPendingTransactionPromiseResult = x[1];

    var maxNonceCount = new BigNumber(0)
      , isNonceCountAvailable = false
      , allPendingNonce = new Array()
    ;

    // get the nonce count from the trasaction object
    const getNonceFromUnminedTransaction = function (unminedTransactions) {
      const allNonce = new Array();
      if (unminedTransactions) {
        for (var nouneKey in unminedTransactions) {
          const transactionObj = unminedTransactions[nouneKey];
          if (transactionObj.nonce) {
            allNonce.push(new BigNumber(transactionObj.nonce));
          }
        }
      }
      return allNonce;
    };

    // get the nounce count from pending transations
    const getPendingNonce = function(pendingTransactions) {
      var allNonce = new Array();
      for (var key in pendingTransactions){
        if (key.toLowerCase() === oThis.address) {
          allNonce = allNonce.concat(getNonceFromUnminedTransaction(pendingTransactions[key]));
        }
      }
      return allNonce;
    };

    // check nonce count from pending transactions
    for (var i = allPendingTransactionPromiseResult.length - 1; i >= 0; i--){
      const currentPendingTransactionResponse =  allPendingTransactionPromiseResult[i];
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
    for (var i = allNoncePromiseResult.length - 1; i >= 0; i--) {
      const currentNonceResponse =  allNoncePromiseResult[i];
      if (currentNonceResponse.isFailure()) {
        continue;
      }

      isNonceCountAvailable = true;
      const currentNonce = new BigNumber(currentNonceResponse.data.mined_transaction_count);
      maxNonceCount = BigNumber.max(currentNonce, maxNonceCount);
    }

    if (isNonceCountAvailable || allPendingNonce.length > 0) {
      if (allPendingNonce.length > 0) {
        for (var i = allPendingNonce.length - 1; i >= 0; i--) {
          const pendingNonceCount = new BigNumber(allPendingNonce[i]);
          maxNonceCount = BigNumber.max(pendingNonceCount.plus(1), maxNonceCount);
        }
      }
      const setNonceResponse = await oThis.cacheImplementer.set(oThis.cacheKey, maxNonceCount.toNumber());
      console.log("maxNonceCount: ", maxNonceCount.toNumber());
      if (setNonceResponse.isSuccess()) {
        return Promise.resolve(responseHelper.successWithData({nonce: maxNonceCount.toNumber()}));
      }
      return Promise.resolve(responseHelper.error('l_nm_syncNonce_1', "unable to set nonce in cache"));
    } else {
      return Promise.resolve(responseHelper.error('l_nm_syncNonce_2', "unable to fetch nonce from geth nodes"));
    }
  },

};

Object.assign(NonceManagerKlass.prototype, NonceCacheKlassPrototype);

module.exports = NonceManagerKlass;

