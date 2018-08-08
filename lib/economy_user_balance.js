'use strict';

/**
 * Fetch total airdrop granted and actual Balance of a user
 *
 * @module lib/economy_user_balance
 */

// load External Packages

const rootPrefix = '..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/storage');
require(rootPrefix + '/lib/providers/payments');
require(rootPrefix + '/lib/cache_management/client_branded_token');

/**
 * Fetch total airdrop granted and actual Balance of users
 *
 * @param {object} params -
 * @param {number} params.client_id - client id of user
 * @param {array} params.ethereum_addresses - ethereum addresses of user
 *
 * @constructorproxyWrapper
 */
const economyUserBalance = function(params) {
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
  perform: async function() {
    const oThis = this,
      responseData = {},
      ClientBrandedTokenCacheKlass = oThis.ic().getClientBrandedTokenCache(),
      clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({ clientId: oThis.clientId }),
      clientBrandedTokenResponse = await clientBrandedTokenCache.fetch();

    if (clientBrandedTokenResponse.isFailure()) {
      logger.notify('l_eub_1', 'Invalid Client branded token response for multiget fetch', clientBrandedTokenResponse, {
        clientId: oThis.clientId
      });

      return Promise.resolve(clientBrandedTokenResponse);
    }

    const clientBrandedToken = clientBrandedTokenResponse.data,
      airdropContractAddress = clientBrandedToken.airdrop_contract_addr,
      erc20Address = clientBrandedToken.token_erc20_address;

    // Fetch Airdrop Balance of users

    const paymentsProvider = oThis.ic().getPaymentsProvider(),
      openSTPayments = paymentsProvider.getInstance(),
      configStrategy = oThis.ic().configStrategy;

    const airdropManagerUserBalanceObj = new openSTPayments.services.airdropManager.userBalance({
      airdrop_contract_address: airdropContractAddress,
      chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
      user_addresses: oThis.ethereumAddresses
    });

    const airdropBalanceResponse = await airdropManagerUserBalanceObj.perform();

    if (airdropBalanceResponse.isFailure()) {
      logger.notify('l_eub_2', 'Error in getAirdropBalance', airdropBalanceResponse, {
        clientId: oThis.clientId,
        ethereum_address: oThis.ethereumAddresses
      });

      return Promise.resolve(airdropBalanceResponse);
    }

    let start_time = Date.now();

    const storageProvider = oThis.ic().getStorageProvider(),
      openSTStorage = storageProvider.getInstance();

    const fetchBalanceObjResponse = await new openSTStorage.cache.TokenBalance({
      erc20_contract_address: erc20Address.toLowerCase(),
      ethereum_addresses: oThis.ethereumAddresses
    }).fetch();

    console.log('------- Balance fetch time taken', (Date.now() - start_time) / 1000);

    if (fetchBalanceObjResponse.isFailure()) {
      logger.notify('l_eub_4', 'Error in fetching balance for ethereum addresses', fetchBalanceObjResponse, {
        clientId: oThis.clientId,
        ethereum_address: oThis.ethereumAddresses
      });

      return Promise.resolve(fetchBalanceObjResponse);
    }

    for (var i in oThis.ethereumAddresses) {
      const ethereumAddress = oThis.ethereumAddresses[i];

      const airdropData = airdropBalanceResponse.data[ethereumAddress] || {},
        totalAirdroppedTokens = airdropData.totalAirdropAmount || 0,
        balanceAirdropAmount = airdropData.balanceAirdropAmount || 0,
        totalAirdroppedTokensBigNumber = basicHelper.convertToBigNumber(totalAirdroppedTokens);

      const tokenBalanceData = fetchBalanceObjResponse.data[ethereumAddress.toLowerCase()],
        btBalanceBigNumber = basicHelper.convertToBigNumber(tokenBalanceData.available_balance),
        tokenBalance = basicHelper.convertToBigNumber(balanceAirdropAmount).add(btBalanceBigNumber),
        unsettledDebits = basicHelper.convertToBigNumber(tokenBalanceData.unsettled_debits),
        settledBalance = basicHelper.convertToBigNumber(tokenBalanceData.settled_balance);

      // Don't change keys of this object frequently, as it is used as an input to balance formatter
      responseData[ethereumAddress] = {
        totalAirdroppedTokens: totalAirdroppedTokensBigNumber,
        tokenBalance: tokenBalance,
        balanceAirdropAmount: balanceAirdropAmount,
        unsettledDebits: unsettledDebits,
        availableBalance: btBalanceBigNumber,
        settledBalance: settledBalance
      };
    }

    return Promise.resolve(responseHelper.successWithData(responseData));
  }
};

InstanceComposer.registerShadowableClass(economyUserBalance, 'getEconomyUserBalance');

module.exports = economyUserBalance;
