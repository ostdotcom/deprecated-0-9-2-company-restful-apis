"use strict";

const Web3 = require('web3')
  , BigNumber = require('bignumber.js')
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , allUtilityGethNodes = chainInteractionConstants.OST_UTILITY_GETH_RPC_PROVIDERS
  , web3Provider = new Web3(allUtilityGethNodes[0])
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , cacheImplementer = require(rootPrefix + '/lib/cache_management/saas_only_cache_engine')
;


const Util = function () {};


Util.prototype = {

  constructor: Util,

  /**
   * Get STPrime balance for the given address
   *
   * @param {string} address - address whose balance needs to be fetched
   *
   * @return {promise<result>}
   */
  getSTPrimeBalanceFor: async function (address) {
    const oThis = this;

    try {
      if (!basicHelper.isAddressValid(address)) {
        return Promise.resolve(responseHelper.error('a_s_u_getSTPrimeBalanceFor_1', "Invalid address", null,
          {}, {sendErrorEmail: false}));
      }

      web3Provider.eth.getBalance(address, function (error, result) {
        if (error) {
          //Format the error
          logger.error("app/services/util.js:getSTPrimeBalanceFor|getBalance inside error ", err);
          return Promise.onResolve(responseHelper.error('a_s_u_getSTPrimeBalanceFor_1', 'Error while getting the balance'));
        }
        return Promise.resolve(responseHelper.successWithData({balance: result}));
      });

    } catch (err) {
      //Format the error
      logger.error("app/services/util.js:getSTPrimeBalanceFor inside catch ", err);
      return Promise.onResolve(responseHelper.error('a_s_u_getSTPrimeBalanceFor_2', 'Something went wrong'));
    }

  },

  /**
   * Check if STPrime is avaialble
   *
   * @param {string} address - address whose STPrime balance availability needs to be checked
   *
   * @return {promise<result>}
   */
  isSTPrimeBalanceAvailable: async function (address) {

    const oThis = this;

    try {
      if (!basicHelper.isAddressValid(address)) {
        return Promise.resolve(responseHelper.error('a_s_u_isSTPrimeBalanceAvailable_1', "Invalid address", null,
          {}, {sendErrorEmail: false}));
      }

      const cacheResponse = await oThis.cacheImplementer.get(oThis.stPrimeBalanceKey(address));

      if (cacheResponse.isSuccess()) {
        return Promise.resolve(responseHelper.successWithData({isBalanceAvailable: cacheResponse.data.response}));
      }
      return Promise.onResolve(responseHelper.error('a_s_u_isSTPrimeBalanceAvailable_1', 'Something went wrong while getting from cache'));

    } catch (err) {
      //Format the error
      logger.error("app/services/util.js:isSTPrimeBalanceAvailable inside catch ", err);
      return Promise.onResolve(responseHelper.error('a_s_u_isSTPrimeBalanceAvailable_2', 'Something went wrong'));
    }

  },

  /**
   * Get STPrime balance cache key
   *
   * @param {string} address - address
   *
   * @return {string}
   */
  stPrimeBalanceKey: function (address) {
    const oThis = this;
    return `utility_${address}_stprime_balance`;
  },


  /**
   * Mark STPrime is unavailable
   *
   * @param {string} address - address
   *
   * @return {promise<result>}
   */
  markSTPrimeUnavailable: async function (address) {
    const oThis = this;

    try {
      if (!basicHelper.isAddressValid(address)) {
        return Promise.resolve(responseHelper.error('a_s_u_markSTPrimeUnavailalbe_1', "Invalid address", null,
          {}, {sendErrorEmail: false}));
      }

      const cacheResponse = await oThis.cacheImplementer.set(oThis.stPrimeBalanceKey(address), 0);
      return Promise.resolve(cacheResponse.isSuccess());

    } catch (err) {
      //Format the error
      logger.error("app/services/util.js:markSTPrimeUnavailalbe inside catch ", err);
      return Promise.onResolve(responseHelper.error('a_s_u_markSTPrimeUnavailalbe_2', 'Something went wrong'));
    }
  },

  /**
   * Mark STPrime is available
   *
   * @param {string} address - address
   *
   * @return {promise<result>}
   */
  markSTPrimeAvailable: async function (address) {
    const oThis = this;

    try {
      if (!basicHelper.isAddressValid(address)) {
        return Promise.resolve(responseHelper.error('a_s_u_markSTPrimeAvailable_1', "Invalid address", null,
          {}, {sendErrorEmail: false}));
      }

      const cacheResponse = await oThis.cacheImplementer.set(oThis.stPrimeBalanceKey(address), 1);
      return Promise.resolve(cacheResponse.isSuccess());

    } catch (err) {
      //Format the error
      logger.error("app/services/util.js:markSTPrimeUnavailalbe inside catch ", err);
      return Promise.onResolve(responseHelper.error('a_s_u_markSTPrimeAvailable_2', 'Something went wrong'));
    }
  }

};

module.exports = new Util;




