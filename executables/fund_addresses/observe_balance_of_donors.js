'use strict';
/**
 * Observe balances of Donors
 *
 * Usage: node executables/fund_addresses/observe_balance_of_donors.js group_id
 *
 * Command Line Parameters Description:
 * group_id: group id for fetching config strategy
 *
 * @module executables/fund_addresses/observe_balance_of_donors
 */

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  notifier = require(rootPrefix + '/helpers/notifier'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/platform');

const args = process.argv,
  group_id = args[2];

let configStrategy = {};

// Usage demo.
const usageDemo = function() {
  logger.log('usage:', 'node executables/fund_addresses/observe_balance_of_donors.js group_id');
  logger.log('* group_id is needed for fetching config strategy');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!group_id) {
    logger.error('Group id is not passed');
    usageDemo();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

/**
 *
 * @constructor
 */
const balanceObserververKlass = function() {
  const oThis = this;

  oThis.notifyLogs = {};
};

balanceObserververKlass.prototype = {
  perform: async function() {
    const oThis = this,
      utilityGethType = 'read_only',
      strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(utilityGethType);

    configStrategy = configStrategyResp.data;

    await oThis._observeFoundationEthBalance();

    await oThis._observeUtilityChainOwnerEthBalance();

    if (Object.keys(oThis.notifyLogs) > 0) {
      notifier.notify('e_fa_1', 'Critical: Balances Too Low For Critical Addresses', oThis.notifyLogs);
    }

    process.exit(1);
  },

  /**
   * fetch eth balance of foundation as it grants Eth to users after signup
   *
   * @return {Promise}
   */
  _observeFoundationEthBalance: async function() {
    const oThis = this,
      foundationAddr = configStrategy.OST_FOUNDATION_ADDR,
      ethBalanceRsp = await oThis._fetchEthBalance(foundationAddr);

    if (ethBalanceRsp.isSuccess()) {
      const ethBalance = ethBalanceRsp.data.balance;

      if (ethBalance < oThis._minFoundationEthBalance) {
        oThis.notifyLogs['foundationEthBalance'] =
          'FoundationEthBalance is less than : ' + oThis._minFoundationEthBalance + ' ETH';
      }
    }
  },

  /**
   * fetch eth balance of utility chain owner as it grants Eth to several other internal addresses
   *
   * @return {Promise}
   */
  _observeUtilityChainOwnerEthBalance: async function() {
    const oThis = this,
      utilityChainOwnerAddr = configStrategy.OST_UTILITY_CHAIN_OWNER_ADDR,
      ethBalanceRsp = await oThis._fetchEthBalance(utilityChainOwnerAddr);

    if (ethBalanceRsp.isSuccess()) {
      const ethBalance = ethBalanceRsp.data.balance;

      if (ethBalance < oThis._minUtilityChainOwnerEthBalance) {
        oThis.notifyLogs['utilityChainOwnerEthBalance'] =
          'UtilityChainOwnerEthBalance is less than : ' + oThis._minUtilityChainOwnerEthBalance + ' ETH';
      }
    }
  },

  /**
   * fetch eth balance
   *
   * @return {Promise}
   */
  _fetchEthBalance: function(address) {
    const oThis = this,
      instanceComposer = new InstanceComposer(configStrategy),
      openStPlatform = instanceComposer.getPlatformProvider().getInstance();

    const obj = new openStPlatform.services.balance.eth({ address: address });

    return obj.perform();
  },

  // thresholds

  _minFoundationEthBalance: 60,

  _minUtilityChainOwnerEthBalance: 60
};

// perform action
const balanceObserververKlassObj = new balanceObserververKlass();
balanceObserververKlassObj.perform();
