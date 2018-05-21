"use strict";

/**
 * Observe balances of Donors
 *
 * @module executables/fund_addresses/observe_balance_of_donors
 */

const rootPrefix = "../.."
    , logger = require(rootPrefix + "/lib/logger/custom_console_logger")
    , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
    , openStPlatform = require('@openstfoundation/openst-platform')
;

/**
 *
 * @constructor
 */
const balanceObserververKlass = function () {

  const oThis = this;

  oThis.notifyLogs = {};

};

balanceObserververKlass.prototype = {

  perform: async function() {

    const oThis = this;

    await oThis._observeFoundationEthBalance();

    await oThis._observeUtilityChainOwnerEthBalance();

    if (Object.keys(oThis.notifyLogs) > 0) {

      logger.notify(
        'e_fa_1',
        'Critical: Balances Too Low For Critical Addresses',
        oThis.notifyLogs
      );

    }

    process.exit(1);

  },

  /**
   * fetch eth balance of foundation as it grants Eth to users after signup
   *
   * @return {Promise}
   */
  _observeFoundationEthBalance: async function() {

    const oThis = this
        , foundationAddr = chainInteractionConstants.FOUNDATION_ADDR
        , ethBalanceRsp = await oThis._fetchEthBalance(foundationAddr);

    if (ethBalanceRsp.isSuccess()) {

      const ethBalance = ethBalanceRsp.data.balance;

      if (ethBalance < oThis._minFoundationEthBalance) {
        oThis.notifyLogs['foundationEthBalance'] = 'FoundationEthBalance is less than : ' + oThis._minFoundationEthBalance + ' ETH';
      }

    }

  },

  /**
   * fetch eth balance of utility chain owner as it grants Eth to several other internal addresses
   *
   * @return {Promise}
   */
  _observeUtilityChainOwnerEthBalance: async function() {

    const oThis = this
        , utilityChainOwnerAddr = chainInteractionConstants.UTILITY_CHAIN_OWNER_ADDR
        , ethBalanceRsp = await oThis._fetchEthBalance(utilityChainOwnerAddr);

    if (ethBalanceRsp.isSuccess()) {

      const ethBalance = ethBalanceRsp.data.balance;

      if (ethBalance < oThis._minUtilityChainOwnerEthBalance) {
        oThis.notifyLogs['utilityChainOwnerEthBalance'] = 'UtilityChainOwnerEthBalance is less than : ' + oThis._minUtilityChainOwnerEthBalance + ' ETH';
      }

    }

  },

  /**
   * fetch eth balance
   *
   * @return {Promise}
   */
  _fetchEthBalance: function (address) {

    const oThis = this;

    const obj = new openStPlatform.services.balance.eth({'address': address});

    return obj.perform();

  },

  // thresholds

  _minFoundationEthBalance: 60,

  _minUtilityChainOwnerEthBalance: 60

};

// perform action
const balanceObserververKlassObj = new balanceObserververKlass();
balanceObserververKlassObj.perform();