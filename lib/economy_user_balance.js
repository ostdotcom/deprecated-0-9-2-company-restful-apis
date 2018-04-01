"use strict";

/**
 * Fetch total airdrop granted and actual Balance of a user
 *
 * @module lib/economy_user_balance
 */

// load External Packages
const openStPlatform = require('@openstfoundation/openst-platform')
  , openStPayments = require('@openstfoundation/openst-payments')
  , AirdropManagerUserBalanceKlass = openStPayments.services.airdropManager.userBalance
;

// load Packages

const rootPrefix = '..'
  , ClientBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/**
 * Fetch total airdrop granted and actual Balance of users
 *
 * @param {object} params -
 * @param {number} params.client_id - client id of user
 * @param {array} params.ethereum_addresses - ethereum addresses of user
 *
 * @constructor
 */
const economyUserBalance = function (params) {

  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.ethereumAddresses = params.ethereum_addresses;

};

economyUserBalance.prototype = {

  /**
   * Get Economy users Balance
   *
   *
   * @return {Promise<result>}
   */
  perform: async function () {

    const oThis = this
      , responseData = {}
      , clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({clientId: oThis.clientId})
      , clientBrandedTokenResponse = await clientBrandedTokenCache.fetch()
    ;

    if (clientBrandedTokenResponse.isFailure()) {
      logger.notify('l_eub_1', 'Invlaid Client branded token response for multiget fetch', clientBrandedTokenResponse);
      return Promise.resolve(clientBrandedTokenResponse);
    }

    const clientBrandedToken = clientBrandedTokenResponse.data
      , airdropContractAddress = clientBrandedToken.airdrop_contract_addr
      , erc20Address = clientBrandedToken.token_erc20_address
    ;

    // Fetch Airdrop Balance of users

    const airdropManagerUserBalanceObj = new AirdropManagerUserBalanceKlass({
      airdrop_contract_address: airdropContractAddress,
      chain_id: chainInteractionConstants.UTILITY_CHAIN_ID,
      user_addresses: oThis.ethereumAddresses
    });

    const airdropBalanceResponse = await airdropManagerUserBalanceObj.perform();

    if (airdropBalanceResponse.isFailure()) {
      logger.notify('l_eub_2', 'Error in getAirdropBalance for ' + oThis.ethereumAddresses, airdropBalanceResponse);
      return Promise.resolve(airdropBalanceResponse);
    }

    const promisesArray = [];

    for (var i in oThis.ethereumAddresses) {
      const ethereumAddress = oThis.ethereumAddresses[i];

      const fetchBalanceObj = new openStPlatform.services.balance.brandedToken({
        erc20_address: erc20Address,
        address: ethereumAddress,
        use_cache: 1
      });

      promisesArray.push(fetchBalanceObj.perform());
    }

    const promiseResults = await Promise.all(promisesArray);


    for (var i in oThis.ethereumAddresses) {
      const ethereumAddress = oThis.ethereumAddresses[i];

      const airdropData = airdropBalanceResponse.data[ethereumAddress] || {}
        , totalAirdroppedTokens = airdropData.totalAirdropAmount || 0
        , balanceAirdropAmount = airdropData.balanceAirdropAmount || 0
        , totalAirdroppedTokensBigNumber = basicHelper.convertToBigNumber(totalAirdroppedTokens)
      ;

      const platformBalanceResponse = promiseResults[i];

      if ((!platformBalanceResponse) || platformBalanceResponse.isFailure()) {
        logger.notify('l_eub_3', "Error in fetching balance of Address - " + ethereumAddress, platformBalanceResponse);
        return Promise.resolve(platformBalanceResponse);
      }

      const btBalanceBigNumber = basicHelper.convertToBigNumber(platformBalanceResponse.data.balance)
        , tokenBalance = basicHelper.convertToBigNumber(balanceAirdropAmount).add(btBalanceBigNumber)
      ;

      responseData[ethereumAddress] = {
        totalAirdroppedTokens: totalAirdroppedTokensBigNumber,
        tokenBalance: tokenBalance,
        balanceAirdropAmount: balanceAirdropAmount
      }
    }

    return Promise.resolve(responseHelper.successWithData(responseData));
  }

};

module.exports = economyUserBalance;

