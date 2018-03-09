"use strict";

const Web3 = require('web3')
  , BigNumber = require('bignumber.js')
  , openStCache = require('@openstfoundation/openst-cache')
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/**
 * @constructor
 *
 * @param {Object} params - cache key address, chain_kind
 *
 */
const NonceManagerKlass = function(params) {

  const oThis = this
  ;

  oThis.address = params['address'].toLowerCase();
  oThis.chainKind = params['chain_kind'];
  oThis.chainId = (oThis.chainKind == 'value') ? chainInteractionConstants.VALUE_CHAIN_ID :
                                                  chainInteractionConstants.UTILITY_CHAIN_ID;

  // Set cacheImplementer to perform caching operations
  oThis.cacheImplementer = openStCache.cache;

  // Set cache key for nonce
  oThis.cacheKey = `nonce_${oThis.chainKind}_${oThis.address}`;

  // Set cache key for nonce lock
  oThis.cacheLockKey = `nonce_${oThis.chainKind}_${oThis.address}_lock`;
};

const NonceCacheKlassPrototype = {

  /**
   * Query if the lock is acquired for the given nonce key
   *
   * @return {boolean}
   */
  isLocked: async function() {
    const oThis = this
      , lockStatusResponse = await oThis.cacheImplementer.get(oThis.cacheLockKey)
    ;

    return lockStatusResponse.isSuccess() && lockStatusResponse.data.response == '1';

  },

  /**
   * Get nonce. This gets the nonce from cache then increments and returns. If not in cache it gets from chain
   *
   * @return {promise<result>}
   */
  getNonce: function() {
    const oThis = this
    ;
      
    const acquireLockAndReturn = async function() {
      const acquireLockResponse = await oThis._acquireLock();
      if (acquireLockResponse.isSuccess()) {
        const nonceResponse = await oThis.cacheImplementer.get(oThis.cacheKey);
        if (nonceResponse.isSuccess() && nonceResponse.data.response != null) {
          return responseHelper.successWithData({nonce: nonceResponse.data.response});
        } else {
          return await oThis._syncNonce();
        }
      } else {
        return acquireLockResponse;
      }
    };

    return new Promise(async function(onResolve, onReject) {

      const wait = async function() {
        try {
          const isLocked = await oThis.isLocked();
          if (isLocked) {
            setTimeout(wait, 100); // 100 milliseconds
          } else {          
            return onResolve(acquireLockAndReturn());
          }
        } catch (err) {
          //Format the error
          logger.error("module_overrides/web3_eth/nonce_manager.js:getNonce:wait inside catch ", err);
          return onResolve(responseHelper.error('l_nm_getNonce_1', 'Something went wrong'));
        }        
      };

      try {
        // if the lock is aquired then wait for unlock
        // if the lock is not aquired then lock the nonce key for usage and return the nonce count
        const isLocked = await oThis.isLocked();    
        if (!isLocked) {
          return onResolve(acquireLockAndReturn());
        } else {
          // the key is already locked. Now wait for it to get unlocked.      
          return wait();
        }
      } catch (err) {
        //Format the error
        logger.error("module_overrides/web3_eth/nonce_manager.js:getNonce inside catch ", err);
        return onResolve(responseHelper.error('l_nm_getNonce_2', 'Something went wrong'));
      }        

    });
  },

  /**
   * completion call back when successfull, this will release the lock
   *
   * @return {promise<result>}
   */
  completionWithSuccess: async function() {
    const oThis = this
    ;

    await oThis._increment();
    return oThis._releaseLock();
  },

  /**
   * completion call back when failure.
   *
   * @param {boolean} shouldSyncNonce - flag if nonce need to be synced with nodes
   *
   * @return {promise<result>}
   */
  completionWithFailure: async function(shouldSyncNonce) {
    const oThis = this
    ;

    if (shouldSyncNonce) {
      await oThis._syncNonce();
    }

    return oThis._releaseLock();
  },

  /**
   * Abort the process.
   *
   * @return {promise<result>}
   */
  abort: async function() {
    const oThis = this
    ;

    oThis._releaseLock();
  },

  /**
   * Acquire the lock the nonce usage for the address
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _acquireLock: function() {
    const oThis = this
    ;

    return oThis.cacheImplementer.set(oThis.cacheLockKey, "1");
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

    return oThis.cacheImplementer.del(oThis.cacheLockKey);

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
      , allGethNodes = (oThis.chainKind == 'value') ? chainInteractionConstants.OST_VALUE_GETH_RPC_PROVIDERS :
                          chainInteractionConstants.OST_UTILITY_GETH_RPC_PROVIDERS
    ;

    for (var i = allGethNodes.length - 1; i >= 0; i--) {
      const gethURL = allGethNodes[i];

      const web3UtilityRpcProvider = new Web3(gethURL);
      web3UtilityRpcProvider.chainId = oThis.chainId;
      web3UtilityRpcProvider.chainKind = oThis.chain_kind;
      allNoncePromise.push(oThis._getNonceFromGethNode(web3UtilityRpcProvider));

    }

    const allNoncePromiseResult = await Promise.all(allNoncePromise);
    
    var maxNonceCount = new BigNumber(0)
      , isNonceValid = true
    ;

    // If any one node is not available then sync fails. Discuss this while code review and remove the isNonceValid check if needed
    for (var i = allNoncePromiseResult.length - 1; i >= 0; i--) {
      const currentNonceResponse =  allNoncePromiseResult[i];
      if (currentNonceResponse.isFailure()) {
          isNonceValid = false;
          break;
      }
      const currentNonce = new BigNumber(currentNonceResponse.data.nonce);
      maxNonceCount = BigNumber.max(currentNonce, maxNonceCount);
    }
    if (isNonceValid) {
      const setNonceResponse = await oThis.cacheImplementer.set(oThis.cacheKey, maxNonceCount.toNumber());
      if (setNonceResponse.isSuccess()) {
        return responseHelper.successWithData({nonce: maxNonceCount.toNumber()});
      }
      return onResolve(responseHelper.error('l_nm_syncNonce_1', "unable to set nonce in cache"));
    } else {
      return onResolve(responseHelper.error('l_nm_syncNonce_2', "unable to fetch nonce from geth nodes"));
    }
  },

  /**
   * Get transactionCount
   *
   * @param {object} web3Provider - web3 object
   *
   * @return {promise<result>}
   * @private
   * @ignore
   */
  _getNonceFromGethNode: async function(web3Provider){
    const oThis = this
    ;

    return new Promise(function(onResolve, onReject) {
      try {
        web3Provider.eth.getTransactionCount(oThis.address, 'pending',function(error, result) {
          if (error) {
            return onResolve(responseHelper.error('l_nm_getNonceFromGethNode_1', error));
          } else {
            return onResolve(responseHelper.successWithData({nonce: result}));
          }         
        });
      } catch (err) {
        //Format the error
        logger.error("module_overrides/web3_eth/nonce_manager.js:getNonceFromGethNode inside catch ", err);
        return onResolve(responseHelper.error('l_nm_getNonceFromGethNode_2', 'Something went wrong'));
      }      
    });    
  },
  
};

Object.assign(NonceManagerKlass.prototype, NonceCacheKlassPrototype);

module.exports = NonceManagerKlass;
