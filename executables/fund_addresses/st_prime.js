"use strict";

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
 * @module executables/fund_addresses/st_prime
 */

// load External Packages
const openStPlatform = require('@openstfoundation/openst-platform');

// Load Packages
const rootPrefix = '../..'
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * constructor for fund addresses with ST PRIME
 *
 * @constructor
 */
const FundUsersWithSTPrimeKlass = function () {};

FundUsersWithSTPrimeKlass.prototype = {

  /**
   * Perform
   *
   */
  perform: async function () {

    const oThis = this;

    for (var i in oThis._interestedUserNames) {
      const userName = oThis._interestedUserNames[i];

      const minBalanceInWei = basicHelper.convertToWei(oThis._utilityChainMinBalanceFor(userName))
        , ethereumAddress = oThis._utilityChainAddressFor(userName)
        , balanceResponse = await oThis._getSTPrimeBalance(ethereumAddress)
      ;

      if (balanceResponse.isFailure()) return Promise.resolve(balanceResponse);

      const balanceBigNumberInWei = balanceResponse.data.balance;

      if (balanceBigNumberInWei.lessThan(minBalanceInWei)) {
        await oThis._transferSTPrimeBalance(ethereumAddress, minBalanceInWei)
      }
    }

    // check if utility chain owner has required min balance
    // keep threshold for utility chain owner sufficiently high so that it is able to fund high no of refills
    const utilityChainOwnerResponse = await oThis._checkBalanceOfChainOwner();

    process.exit(0);

  },

  /**
   * Check ST Prime Balance of Utility Chain Owner and notify if less
   *
   * @returns {promise<result>}
   * @private
   */
  _checkBalanceOfChainOwner: async function () {

    const oThis = this
      , minUCOBalanceInWei = basicHelper.convertToWei(oThis._utilityChainMinBalanceFor('utilityChainOwner'))
      , ucOwnerBalanceResponse = await oThis._getSTPrimeBalance(oThis._utilityChainAddressFor('utilityChainOwner'))
    ;

    if (ucOwnerBalanceResponse.isFailure()) return Promise.resolve(ucOwnerBalanceResponse);

    const ucOwnerBalanceBigNumberInWei = ucOwnerBalanceResponse.data.balance;

    if (ucOwnerBalanceBigNumberInWei.lessThan(minUCOBalanceInWei)) {
      logger.notify('e_fa_e_cboco_1', 'ST PRIME Balance Of Utility Chain Owner is LOW',
        {
          utility_chain_owner_balance_st_prime: basicHelper.convertToNormal(ucOwnerBalanceBigNumberInWei),
          min_required_balance: oThis._utilityChainMinBalanceFor('utilityChainOwner')
        }
      );
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
  _getSTPrimeBalance: async function (ethereumAddress) {

    const oThis = this
      , fetchBalanceObj = new openStPlatform.services.balance.simpleTokenPrime({address: ethereumAddress})
      , balanceResponse = await fetchBalanceObj.perform()
    ;

    if (balanceResponse.isFailure()) {
      logger.notify('e_fa_sp_ceb_1', "Error in fetching balance of Address - " + ethereumAddress, balanceResponse);
      return Promise.resolve(balanceResponse);
    }

    const stPrimeBalanceBigNumber = basicHelper.convertToBigNumber(balanceResponse.data.balance);

    return Promise.resolve(responseHelper.successWithData({balance: stPrimeBalanceBigNumber}));
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
  _transferSTPrimeBalance: async function (ethereumAddress, transferAmountInWei) {

    const oThis = this
      , transferSTPrimeBalanceObj = new openStPlatform.services.transaction.transfer.simpleTokenPrime({
        sender_name: 'utilityChainOwner',
        recipient_address: ethereumAddress,
        amount_in_wei: transferAmountInWei,
        options: {returnType: 'txReceipt', tag: 'GasRefill'}
      })
    ;

    const transferResponse = await transferSTPrimeBalanceObj.perform();

    if (transferResponse.isFailure()) {
      logger.notify('e_fa_sp_teb_1', "Error in transfer of " + transferAmountInWei + "Wei ST Prime to Address - " + ethereumAddress, transferResponse);
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
  _utilityChainMinBalanceFor: function (name) {
    const oThis = this
      , nameData = oThis._utilityChainData[name]
    ;

    if (!nameData) {
      logger.notify('e_fa_sp_ucbb_1', "Invalid user name passed for getting data - " + name);
      throw "Invalid user name passed for getting data - " + name;
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
  _utilityChainAddressFor: function (name) {
    const oThis = this
      , nameData = oThis._utilityChainData[name]
    ;

    if (!nameData) {
      logger.notify('e_fa_sp_ucaf_1', "Invalid user name passed for getting data - " + name);
      throw "Invalid user name passed for getting data - " + name;
    }

    return nameData.address;
  },

  /**
   * utility chain data for users
   *
   * @constant
   *
   * @private
   */
  _utilityChainData: {
    utilityChainOwner: {minBalance: '10', address: chainInteractionConstants.UTILITY_CHAIN_OWNER_ADDR},
    staker: {minBalance: '1', address: chainInteractionConstants.STAKER_ADDR},
    redeemer: {minBalance: '1', address: chainInteractionConstants.REDEEMER_ADDR},
    utilityRegistrar: {minBalance: '1', address: chainInteractionConstants.UTILITY_REGISTRAR_ADDR},
    utilityDeployer: {minBalance: '1', address: chainInteractionConstants.UTILITY_DEPLOYER_ADDR},
    utilityOps: {minBalance: '1', address: chainInteractionConstants.UTILITY_OPS_ADDR}
  },

  /**
   * User names to refill if threshold reach
   *
   * @constant
   *
   * @private
   */
  _interestedUserNames: [
    'staker',
    'redeemer',
    'utilityRegistrar',
    'utilityDeployer',
    'utilityOps'
  ]

};

// perform action
const FundUsersWithSTPrimeObj = new FundUsersWithSTPrimeKlass();
FundUsersWithSTPrimeObj.perform();