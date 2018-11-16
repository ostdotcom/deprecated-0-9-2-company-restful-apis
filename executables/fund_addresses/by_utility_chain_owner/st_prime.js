'use strict';

/**
 * Refill ST PRIME to required service addresses
 *
 * Utility chain owner refills following addresses with ST PRIME:
 *   1. Staker
 *   2. Redeemer
 *   3. Utility Registrar
 *   4. Utility Deployer
 *   5. Utility Ops
 *
 * If utility chain owner's ST PRIME goes down to a certain number, emails will be sent and
 * manually ST PRIME will be transferred by funder address.
 *
 * Usage: node executables/fund_addresses/by_utility_chain_owner/st_prime.js group_id
 *
 * Command Line Parameters Description:
 * group_id: group id for fetching config strategy
 *
 * @module executables/fund_addresses/by_utility_chain_owner/st_prime
 */

const rootPrefix = '../../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

// load External Packages
require(rootPrefix + '/lib/providers/platform');

// Load Packages
const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

const args = process.argv,
  group_id = args[2];

let configStrategy = {};

// Usage demo.
const usageDemo = function() {
  logger.log(
    'usage:',
    'node ./executables/block_scanner/for_tx_status_and_balance_sync.js processLockId datafilePath group_id [benchmarkFilePath]'
  );
  logger.log(
    '* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.'
  );
  logger.log('* datafilePath is the path to the file which is storing the last block scanned info.');
  logger.log('* group_id is needed for fetching config strategy');
  logger.log('* benchmarkFilePath is the path to the file which is storing the benchmarking info.');
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!group_id) {
    logger.error('group_id is not passed');
    usageDemo();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

/**
 * constructor for fund addresses with ST PRIME
 *
 * @constructor
 */
const FundUsersWithSTPrimeFromUtilityChainOwnerKlass = function() {};

FundUsersWithSTPrimeFromUtilityChainOwnerKlass.prototype = {
  /**
   * Perform
   *
   */
  perform: async function() {
    const oThis = this;

    let strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash();

    configStrategy = configStrategyResp.data;

    for (let i in oThis._interestedUserNames) {
      const userName = oThis._interestedUserNames[i];

      const minBalanceInWei = basicHelper.convertToWei(oThis._utilityChainMinBalanceFor(userName)),
        ethereumAddress = oThis._utilityChainAddressFor(userName),
        balanceResponse = await oThis._getSTPrimeBalance(ethereumAddress);

      if (balanceResponse.isFailure()) return Promise.resolve(balanceResponse);

      const balanceBigNumberInWei = balanceResponse.data.balance;

      if (balanceBigNumberInWei.lessThan(minBalanceInWei)) {
        logger.debug("Funding ST' to ", userName);
        await oThis._transferSTPrimeBalance(ethereumAddress, minBalanceInWei);
      }
    }

    // Check if utility chain owner has required min balance.
    // Keep threshold for utility chain owner sufficiently high so that it is able to fund high no of refills.
    await oThis._checkBalanceOfChainOwner();

    logger.debug('Can exit now');
    process.exit(0);
  },

  /**
   * Check ST Prime Balance of Utility Chain Owner and notify if less
   *
   * @returns {Promise<result>}
   * @private
   */
  _checkBalanceOfChainOwner: async function() {
    const oThis = this,
      minUCOBalanceInWei = basicHelper.convertToWei(oThis._utilityChainMinBalanceFor('utilityChainOwner')),
      ucOwnerBalanceResponse = await oThis._getSTPrimeBalance(oThis._utilityChainAddressFor('utilityChainOwner'));

    if (ucOwnerBalanceResponse.isFailure()) return Promise.resolve(ucOwnerBalanceResponse);

    const ucOwnerBalanceBigNumberInWei = ucOwnerBalanceResponse.data.balance;

    if (ucOwnerBalanceBigNumberInWei.lessThan(minUCOBalanceInWei)) {
      logger.notify('e_fa_e_cboco_1', 'ST PRIME Balance Of Utility Chain Owner is LOW', {
        utility_chain_owner_utility_chain_address: oThis._utilityChainAddressFor('utilityChainOwner'),
        utility_chain_owner_balance_st_prime: basicHelper.convertToNormal(ucOwnerBalanceBigNumberInWei),
        min_required_balance: oThis._utilityChainMinBalanceFor('utilityChainOwner')
      });
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Get ST Prime Balance of an Address
   *
   * @param {string} ethereumAddress - Address to check balance for
   *
   * @returns {Promise<result>}
   * @private
   */
  _getSTPrimeBalance: async function(ethereumAddress) {
    const oThis = this,
      instanceComposer = new InstanceComposer(configStrategy),
      openStPlatform = instanceComposer.getPlatformProvider().getInstance(),
      fetchBalanceObj = new openStPlatform.services.balance.simpleTokenPrime({ address: ethereumAddress }),
      balanceResponse = await fetchBalanceObj.perform();

    oThis.openStPlatform = openStPlatform; // for later use

    if (balanceResponse.isFailure()) {
      logger.notify('e_fa_sp_ceb_1', 'Error in fetching balance of Address', balanceResponse, {
        ethereum_address: ethereumAddress
      });
      return Promise.resolve(balanceResponse);
    }

    const stPrimeBalanceBigNumber = basicHelper.convertToBigNumber(balanceResponse.data.balance);

    return Promise.resolve(responseHelper.successWithData({ balance: stPrimeBalanceBigNumber }));
  },

  /**
   * Transfer ST Prime to an address
   *
   * @param {string} ethereumAddress - Address to transfer ST Prime to
   * @param {string} transferAmountInWei - Amount to be transferred to the given address in Wei
   *
   * @returns {Promise<result>}
   * @private
   */
  _transferSTPrimeBalance: async function(ethereumAddress, transferAmountInWei) {
    const oThis = this,
      transferSTPrimeBalanceObj = new oThis.openStPlatform.services.transaction.transfer.simpleTokenPrime({
        sender_name: 'utilityChainOwner',
        recipient_address: ethereumAddress,
        amount_in_wei: transferAmountInWei,
        options: { returnType: 'txReceipt', tag: '' }
      });

    const transferResponse = await transferSTPrimeBalanceObj.perform();

    if (transferResponse.isFailure()) {
      logger.notify(
        'e_fa_sp_teb_1',
        'Error in transfer of ' + transferAmountInWei + 'Wei ST Prime to Address - ' + ethereumAddress,
        transferResponse
      );
      return Promise.resolve(transferResponse);
    }

    return Promise.resolve(transferResponse);
  },

  /**
   * Utility chain min balance for a user name
   *
   * @param {string} name - name of user
   *
   * @returns {string} min balance required for the user in ST Prime
   * @private
   */
  _utilityChainMinBalanceFor: function(name) {
    const oThis = this,
      utilityChainBalance = oThis._utilityChainBalanceRequirements(),
      nameData = utilityChainBalance[name];

    if (!nameData) {
      logger.notify('e_fa_sp_ucbb_1', 'Invalid user name passed for getting data - ' + name);

      throw 'Invalid user name passed for getting data - ' + name;
    }

    return nameData.minBalance;
  },

  /**
   * Utility chain address for a user name
   *
   * @param {string} name - name of user
   *
   * @returns {string} address of the user
   * @private
   */
  _utilityChainAddressFor: function(name) {
    const oThis = this,
      utilityChainBalance = oThis._utilityChainBalanceRequirements(),
      nameData = utilityChainBalance[name];

    if (!nameData) {
      logger.notify('e_fa_sp_ucaf_1', 'Invalid user name passed for getting data - ' + name);

      throw 'Invalid user name passed for getting data - ' + name;
    }

    return nameData.address;
  },

  /**
   * utility chain Addresses and Min Balances
   *
   * @return {Map}
   *
   */
  _utilityChainBalanceRequirements: function() {
    if (basicHelper.isProduction() || basicHelper.isMainSubEnvironment()) {
      return {
        utilityChainOwner: { minBalance: '10', address: configStrategy.OST_UTILITY_CHAIN_OWNER_ADDR },
        staker: { minBalance: '1', address: configStrategy.OST_STAKER_ADDR },
        redeemer: { minBalance: '1', address: configStrategy.OST_REDEEMER_ADDR },
        utilityRegistrar: { minBalance: '1', address: configStrategy.OST_UTILITY_REGISTRAR_ADDR },
        utilityDeployer: { minBalance: '1', address: configStrategy.OST_UTILITY_DEPLOYER_ADDR },
        utilityOps: { minBalance: '1', address: configStrategy.OST_UTILITY_OPS_ADDR }
      };
    } else {
      return {
        utilityChainOwner: { minBalance: '60', address: configStrategy.OST_UTILITY_CHAIN_OWNER_ADDR },
        staker: { minBalance: '10', address: configStrategy.OST_STAKER_ADDR },
        redeemer: { minBalance: '10', address: configStrategy.OST_REDEEMER_ADDR },
        utilityRegistrar: { minBalance: '10', address: configStrategy.OST_UTILITY_REGISTRAR_ADDR },
        utilityDeployer: { minBalance: '10', address: configStrategy.OST_UTILITY_DEPLOYER_ADDR },
        utilityOps: { minBalance: '10', address: configStrategy.OST_UTILITY_OPS_ADDR }
      };
    }
  },

  /**
   * User names to refill if threshold reach
   *
   * @constant
   *
   * @private
   */
  _interestedUserNames: ['staker', 'redeemer', 'utilityRegistrar', 'utilityDeployer', 'utilityOps']
};

// Perform action.
const FundUsersWithSTPrimeObj = new FundUsersWithSTPrimeFromUtilityChainOwnerKlass();
FundUsersWithSTPrimeObj.perform();
