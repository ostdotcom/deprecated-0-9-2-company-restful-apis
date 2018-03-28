"use strict";

const Web3 = require('web3')
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , allUtilityGethNodes = chainInteractionConstants.OST_UTILITY_GETH_WS_PROVIDERS
  , web3Provider = new Web3(allUtilityGethNodes[0])
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , cacheImplementer = require(rootPrefix + '/lib/cache_management/saas_only_cache_engine')
;


const UserStPrimeAvailability = function () {};


UserStPrimeAvailability.prototype = {

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
          logger.error("app/services/user_stPrime_availability.js:getSTPrimeBalanceFor|getBalance inside error ", err);
          return Promise.resolve(responseHelper.error('l_cm_usta_getSTPrimeBalanceFor_1', 'Error while getting the balance'));
        }
        return Promise.resolve(responseHelper.successWithData({balance: result}));
      });

    } catch (err) {
      //Format the error
      logger.error("app/services/user_stPrime_availability.js:getSTPrimeBalanceFor inside catch ", err);
      return Promise.resolve(responseHelper.error('l_cm_usta_getSTPrimeBalanceFor_2', 'Something went wrong'));
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
        return Promise.resolve(responseHelper.error('l_cm_usta_isSTPrimeBalanceAvailable_1', "Invalid address", null,
          {}, {sendErrorEmail: false}));
      }

      const cacheResponse = await cacheImplementer.get(oThis.stPrimeBalanceKey(address));

      if (cacheResponse.isSuccess()) {
        return Promise.resolve(responseHelper.successWithData({isBalanceAvailable: cacheResponse.data.response}));
      }
      return Promise.resolve(responseHelper.error('l_cm_usta_isSTPrimeBalanceAvailable_1', 'Something went wrong while getting from cache'));

    } catch (err) {
      //Format the error
      logger.error("app/services/user_stPrime_availability.js:isSTPrimeBalanceAvailable inside catch ", err);
      return Promise.resolve(responseHelper.error('l_cm_usta_isSTPrimeBalanceAvailable_2', 'Something went wrong'));
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
    return oThis._updateSTPrimeCache(address, 0);
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
    return oThis._updateSTPrimeCache(address, 1);
  },

  /**
   * Update StPrime cache
   *
   * @param {string} address - address
   * @param {number} value - value that needs to be set
   *
   * @return {promise<result>}
   */
  _updateSTPrimeCache: async function (address, value) {
    const oThis = this;

    try {
      if (!basicHelper.isAddressValid(address)) {
        return Promise.resolve(responseHelper.error('l_cm_usta_updateSTPrimeCache_1', "Invalid address", null,
          {}, {sendErrorEmail: false}));
      }

      const cacheResponse = await cacheImplementer.set(oThis.stPrimeBalanceKey(address), value);
      return Promise.resolve(cacheResponse.isSuccess());

    } catch (err) {
      //Format the error
      logger.error("app/services/user_stPrime_availability.js:updateSTPrimeCache inside catch ", err);
      return Promise.resolve(responseHelper.error('l_cm_usta_updateSTPrimeCache_2', 'Something went wrong'));
    }
  }

};

module.exports = UserStPrimeAvailability;




