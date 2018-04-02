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
    logger.log("NM :: NonceManagerKlass :: existingInstance FOUND!");
    return existingInstance;
  } else {
    oThis.nonceHelper.setInstance(oThis, instanceKey);
  }

  logger.log("NM :: NonceManagerKlass :: creating new instance");

  oThis.address = fromAddress;
  oThis.chainKind = chainKind;
  oThis.promiseQueue = [];
  oThis.processedQueue = [];

  // Set cacheImplementer to perform caching operations
  oThis.cacheImplementer = cacheImplementer;

  // Set cache key for nonce
  oThis.cacheKey = `nonce_${oThis.chainKind}_${oThis.address}`;
  logger.log("NM :: NonceManagerKlass :: oThis.cacheKey: ",oThis.cacheKey);
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

    logger.log("NM :: getNonce called.");

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
        logger.log("NM :: onResolve :: Correct context removed.");
      } else {
        logger.error("NM :: onResolve :: Could not find promise context.");
      }

      setTimeout(function () {
        oThis.isProcessing = false;
        oThis.processNext();
      }, 1);

      promiseContext.nonce = result.success ? result.data.nonce : "---FAILED---";
      promiseContext.promiseAction = "RESOLVED";
      var resolve = promiseContext.resolve;
      try {
        resolve( result );  
      } catch( e ) {
        logger.error("NM :: processNext :: onResolve :: promise resolve threw an exception. Error: ", e);
        logger.trace("NM :: processNext :: onResolve :: promise resolve threw an exception.");
      }
    };

    const onReject = function ( reason ) {
      const unshiftedContext = oThis.promiseQueue.shift();
      oThis.processedQueue.push( unshiftedContext );

      if ( promiseContext == unshiftedContext ) {
        logger.log("NM :: onReject :: Correct context removed");
      } else {
        logger.error("NM :: onReject :: IMPORTANT :: promiseQueue is out of sync.");
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
          logger.log("NM :: acquireLockAndReturn :: nonceResponse: ", nonceResponse);
          return responseHelper.successWithData({nonce: parseInt(nonceResponse.data.response)});
        } else {
          return await oThis._syncNonce();
        }
      } else {
        return acquireLockResponse;
      }
    };


    const startTime =  promiseContext.startTimestamp;

    const wait = function() {
      try {
        //Check for timeout.
        if (_getTimeStamp()-startTime > waitTimeout) {  
          //Format the error
          logger.error("NM :: wait :: promise has timed out");
          var errorResult = responseHelper.error('l_nm_getNonce_1', 'getNonce timeout', "nounce_manager", {
            timedOut: true
          });
          return onResolve( errorResult );
        }

        //Try to acquire lock directly.
        acquireLockAndReturn()
          .catch( function ( reason ) {
            logger.error("NM :: acquireLockAndReturn rejected the Promise. reason :: ", reason);
            return responseHelper.error('l_nm_aqLockCatch_1', 'Something went wrong');
          })
          .then( function ( acquireLockResponse ) {
            if ( acquireLockResponse.isSuccess() ) {
              //We got the lock.
              return onResolve( acquireLockResponse );
            } else if ( acquireLockResponse.err && acquireLockResponse.err.code && String(acquireLockResponse.err.code).indexOf( "l_nm_aqLockCatch_1" ) >= 0 ) {
              //Safety-Net. acquireLockAndReturn reject the Promise.
              return onResolve( acquireLockResponse );
            } else {
              //Lets try again to aquire lock.
              setTimeout(wait, waitTimeInterval);
            }
          });
      } catch (err) {
        //Format the error
        logger.error("NM :: IMPORTANT :: wait inside catch ", err);
        return onResolve(responseHelper.error('l_nm_getNonce_2', 'Something went wrong'));
      }
    };

    try {
      return wait();
    } catch (err) {
      //Format the error
      logger.error("NM :: IMPORTANT :: processNext inside catch ", err);
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
    logger.log("NM :: completionWithSuccess");
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
    logger.log("NM :: completionWithFailure");
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
    logger.log("NM :: oThis.cacheLockKey: ",oThis.cacheLockKey);
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
      , allGethNodes = oThis._getAllGethNodes(oThis.chainKind)
    ;

    for (var i = allGethNodes.length - 1; i >= 0; i--) {
      const gethURL = allGethNodes[i];

      const web3Provider = oThis.nonceHelper.getWeb3Instance(gethURL, oThis.chain_kind);
      allNoncePromise.push(oThis.nonceHelper.getNonceFromGethNode(oThis.address, web3Provider));
      allPendingTransactionPromise.push(oThis.nonceHelper.getPendingTransactionsFromGethNode(web3Provider));
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
      logger.log("NM :: maxNonceCount: ", maxNonceCount.toNumber());
      if (setNonceResponse.isSuccess()) {
        return Promise.resolve(responseHelper.successWithData({nonce: maxNonceCount.toNumber()}));
      }
      return Promise.resolve(responseHelper.error('l_nm_syncNonce_1', "unable to set nonce in cache"));
    } else {
      return Promise.resolve(responseHelper.error('l_nm_syncNonce_2', "unable to fetch nonce from geth nodes"));
    }
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

Object.assign(NonceManagerKlass.prototype, NonceCacheKlassPrototype);

module.exports = NonceManagerKlass;

