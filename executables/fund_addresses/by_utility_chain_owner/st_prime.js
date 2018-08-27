'use strict';

/**
 * Refill ST PRIME to required service addresses
 *
 * <br><br>Utility chain owner refills following addresses with ST PRIME:
 * <ol>
 *   <li> Staker</li>
 *   <li> Redeemer</li>
 *   <li> Utility Registrar</li>
 *   <li> Utility Deployer</li>
 *   <li> Utility Ops</li>
 * </ol>
 *
 * <br><br>If utility chain owner's ST PRIME goes down to a certain number, emails will be sent and
 * manually ST PRIME will be transferred by funder address.
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
  InstanceComposer = require(rootPrefix + '/instance_composer');

const args = process.argv,
  config_file_path = args[2],
  configStrategy = require(config_file_path),
  instanceComposer = new InstanceComposer(configStrategy),
  openStPlatform = instanceComposer.getPlatformProvider().getInstance();

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

    for (var i in oThis._interestedUserNames) {
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

    // check if utility chain owner has required min balance
    // keep threshold for utility chain owner sufficiently high so that it is able to fund high no of refills
    const utilityChainOwnerResponse = await oThis._checkBalanceOfChainOwner();

    logger.debug('Can exit now');
    process.exit(0);
  },

  /**
   * Check ST Prime Balance of Utility Chain Owner and notify if less
   *
   * @returns {promise<result>}
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
        utiltiy_chain_owner_utility_chain_address: oThis._utilityChainAddressFor('utilityChainOwner'),
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
   * @returns {promise<result>}
   * @private
   */
  _getSTPrimeBalance: async function(ethereumAddress) {
    const oThis = this,
      fetchBalanceObj = new openStPlatform.services.balance.simpleTokenPrime({ address: ethereumAddress }),
      balanceResponse = await fetchBalanceObj.perform();

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
   * @returns {promise<result>}
   * @private
   */
  _transferSTPrimeBalance: async function(ethereumAddress, transferAmountInWei) {
    const oThis = this,
      transferSTPrimeBalanceObj = new openStPlatform.services.transaction.transfer.simpleTokenPrime({
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
    const oThis = this;

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

// perform action
const FundUsersWithSTPrimeObj = new FundUsersWithSTPrimeFromUtilityChainOwnerKlass();
FundUsersWithSTPrimeObj.perform();
