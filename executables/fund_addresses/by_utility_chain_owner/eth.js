"use strict";

/**
 * Refill ETH to required service addresses
 *
 * <br><br>Utility chain owner refills following addresses with ETH:
 * <ol>
 *   <li> Staker</li>
 *   <li> Redeemer</li>
 *   <li> Value Registrar</li>
 *   <li> Value Deployer</li>
 *   <li> Value Ops</li>
 * </ol>
 *
 * <br><br>If utility chain owner's ETH goes down to a certain number, emails will be sent and
 * manually ETH will be transferred by funder address.
 *
 * @module executables/fund_addresses/by_utility_chain_owner/eth
 */
const rootPrefix = '../../..'
;

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

// load External Packages
const openStPlatform = require('@openstfoundation/openst-platform');

// Load Packages
const chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * constructor for fund addresses with ETH
 *
 * @constructor
 */
const FundUsersWithEthFromUtilityChainOwnerKlass = function (isChainSetUp) {

  const oThis = this;

  oThis.isChainSetUp = isChainSetUp;

};

FundUsersWithEthFromUtilityChainOwnerKlass.prototype = {

  /**
   * Perform
   *
   */
  perform: async function () {

    const oThis = this
      , interestedUserNames = oThis._interestedUserNames()
    ;

    for (let i in interestedUserNames) {
      const userName = interestedUserNames[i];

      const minBalanceInWei = basicHelper.convertToWei(oThis._valueChainMinBalanceFor(userName))
        , ethereumAddress = oThis._valueChainAddressFor(userName)
        , balanceResponse = await oThis._getEthBalance(ethereumAddress)
      ;

      if (balanceResponse.isFailure()) return Promise.resolve(balanceResponse);

      const balanceBigNumberInWei = balanceResponse.data.balance;

      if (balanceBigNumberInWei.lessThan(minBalanceInWei)) {
        logger.debug("Funding ETH to ", userName);
        await oThis._transferEthBalance(ethereumAddress, minBalanceInWei)
      }
    }

    // check if utility chain owner has required min balance
    // keep threshold for utility chain owner sufficiently high so that it is able to fund high no of refills
    const utilityChainOwnerResponse = await oThis._checkBalanceOfChainOwner();

    logger.debug("Can exit now");
    process.exit(0);

  },

  /**
   * Check Ether Balance of Utility Chain Owner and notify if less
   *
   * @returns {promise<result>}
   * @private
   */
  _checkBalanceOfChainOwner: async function () {

    const oThis = this
      , minUCOBalanceInWei = basicHelper.convertToWei(oThis._valueChainMinBalanceFor('utilityChainOwner'))
      , ucOwnerBalanceResponse = await oThis._getEthBalance(oThis._valueChainAddressFor('utilityChainOwner'))
    ;

    if (ucOwnerBalanceResponse.isFailure()) return Promise.resolve(ucOwnerBalanceResponse);

    const ucOwnerBalanceBigNumberInWei = ucOwnerBalanceResponse.data.balance;

    if (ucOwnerBalanceBigNumberInWei.lessThan(minUCOBalanceInWei)) {
      logger.notify(
        'e_fa_e_cboco_1',
        'ETHER Balance Of Utility Chain Owner is LOW',
        {
          utiltiy_chain_owner_value_chain_address: oThis._valueChainAddressFor('utilityChainOwner'),
          utility_chain_owner_balance_eth: basicHelper.convertToNormal(ucOwnerBalanceBigNumberInWei),
          min_required_balance: oThis._valueChainMinBalanceFor('utilityChainOwner')
        }
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Get Ether Balance of an Address
   *
   * @param {string} ethereumAddress - Address to check balance for
   *
   * @returns {promise<result>}
   * @private
   */
  _getEthBalance: async function (ethereumAddress) {

    const oThis = this
      , fetchBalanceObj = new openStPlatform.services.balance.eth({address: ethereumAddress})
      , balanceResponse = await fetchBalanceObj.perform()
    ;

    if (balanceResponse.isFailure()) {
      logger.notify(
        'e_fa_e_ceb_1',
        'Error in fetching balance of Address',
        balanceResponse,
        {ethereum_address: ethereumAddress}
      );
      return Promise.resolve(balanceResponse);
    }

    const ethBalanceBigNumber = basicHelper.convertToBigNumber(balanceResponse.data.balance);

    return Promise.resolve(responseHelper.successWithData({balance: ethBalanceBigNumber}));
  },

  /**
   * Transfer Ether to an address
   *
   * @param {string} ethereumAddress - Address to transfer ether to
   * @param {string} transferAmountInWei - Amount to be transferred to the given address in Wei
   *
   * @returns {promise<result>}
   * @private
   */
  _transferEthBalance: async function (ethereumAddress, transferAmountInWei) {

    const oThis = this
      , transferEthBalanceObj = new openStPlatform.services.transaction.transfer.eth({
        sender_name: 'utilityChainOwner',
        recipient_address: ethereumAddress,
        amount_in_wei: transferAmountInWei,
        options: {returnType: 'txReceipt', tag: ''}
      })
    ;

    const transferResponse = await transferEthBalanceObj.perform();

    if (transferResponse.isFailure()) {
      logger.notify(
        'e_fa_e_teb_1',
        "Error in transfer of " + transferAmountInWei + "Wei Eth to Address - " + ethereumAddress,
        transferResponse
      );
      return Promise.resolve(transferResponse);
    }

    return Promise.resolve(transferResponse);
  },

  /**
   * Value chain min balance for a user name
   *
   * @param {string} name - name of user
   *
   * @returns {string} min balance required for the user in ether
   * @private
   */
  _valueChainMinBalanceFor: function (name) {
    const oThis = this
      , valueChainBalance = basicHelper.valueChainBalanceRequirements()
      , nameData = valueChainBalance[name]
    ;

    if (!nameData) {
      logger.notify(
        'e_fa_e_vcbb_1',
        'Invalid user name passed for getting data - ' + name
      );

      throw "Invalid user name passed for getting data - " + name;
    }

    return nameData.minBalance;
  },

  /**
   * Value chain address for a user name
   *
   * @param {string} name - name of user
   *
   * @returns {string} address of the user
   * @private
   */
  _valueChainAddressFor: function (name) {
    const oThis = this
      , valueChainBalance = basicHelper.valueChainBalanceRequirements()
      , nameData = valueChainBalance[name]
    ;

    if (!nameData) {
      logger.notify(
        'e_fa_e_vcaf_1',
        'Invalid user name passed for getting data - ' + name
      );

      throw "Invalid user name passed for getting data - " + name;
    }

    return nameData.address;
  },

  /**
   * User names to refill if threshold reach
   *
   * @constant
   *
   * @private
   */
  _interestedUserNames: function() {

    const oThis = this;

    if (oThis.isChainSetUp) {
      return [
        'staker',
        // 'redeemer',
        'valueRegistrar',
        'valueDeployer',
        'valueOps'
      ]
    } else {
      return [
        'staker',
        // 'redeemer',
        'valueRegistrar'
        // 'valueDeployer',
        // 'valueOps'
      ]
    }

  },

};

const usageDemo = function () {
  logger.log('usage:', 'node ./executables/fund_addresses/by_utility_chain_owner/eth.js true');
};

const args = process.argv;

let isChainSetUp = args[2];

const validateAndSanitize = function () {

  if (!isChainSetUp) {
    isChainSetUp = false;
  }

};

// validate and sanitize the input params
validateAndSanitize();

// perform action
const FundUsersWithEthObj = new FundUsersWithEthFromUtilityChainOwnerKlass(isChainSetUp);
FundUsersWithEthObj.perform();