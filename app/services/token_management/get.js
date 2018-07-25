'use strict';

const BigNumber = require('bignumber.js');

const rootPrefix = '../../..',
  ClientBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token'),
  ClientSecuredBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure'),
  ostPriceCacheKlass = require(rootPrefix + '/lib/cache_management/ost_price_points'),
  ucBalanceFetcherKlass = require(rootPrefix + '/app/services/address/utilityChainBalancesFetcher'),
  chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants'),
  GetStakedAmountKlass = require(rootPrefix + '/app/services/stake_and_mint/get_staked_amount'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address');

/**
 *
 * @constructor
 *
 * @param {object} params - this is object with keys.
 * @param {integer} params.client_id - client_id for which users are to be fetched
 *
 */
const GetBrandedTokenKlass = function(params) {
  const oThis = this;

  oThis.clientId = params.client_id;
};

GetBrandedTokenKlass.prototype = {
  /**
   *
   * Perform
   *
   * @return {Promise<result>}
   *
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 's_tm_g_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   *
   * Perform
   *
   * @private
   *
   * @return {Promise<result>}
   *
   */
  asyncPerform: async function() {
    const oThis = this,
      clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({ clientId: oThis.clientId }),
      clientBrandedTokenResponse = await clientBrandedTokenCache.fetch(),
      ostPrices = await new ostPriceCacheKlass().fetch(),
      responseData = { result_type: 'token' };

    if (clientBrandedTokenResponse.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'am_dt_ta_b_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: {},
          error_config: errorConfig
        })
      );
    }

    const tokenData = clientBrandedTokenResponse.data;

    const fetchBTMintedAmountRsp = await oThis.fetchBTMintedAmount(tokenData.symbol, tokenData.conversion_factor);

    const tokenSecureDataRsp = await new ClientSecuredBrandedTokenCacheKlass({ tokenSymbol: tokenData.symbol }).fetch(),
      tokenSecureData = tokenSecureDataRsp.data;

    const fetchSTPrimeBalanceRsp = await oThis.fetchSTPrimeBalance(tokenSecureData.reserve_address_uuid);

    const reserveManagedAddressId = tokenData.reserve_managed_address_id;
    const managedAddressSqlResponse = await new ManagedAddressModel()
      .select('*')
      .where(['id=?', reserveManagedAddressId])
      .fire();
    const managedAddressObj = managedAddressSqlResponse[0];

    responseData[responseData.result_type] = {
      company_uuid: managedAddressObj.uuid,
      name: tokenData.name,
      symbol: tokenData.symbol,
      symbol_icon: tokenData.symbol_icon,
      conversion_factor: tokenData.conversion_factor,
      token_erc20_address: tokenSecureData.token_erc20_address,
      airdrop_contract_address: tokenSecureData.airdrop_contract_address,
      simple_stake_contract_address: tokenSecureData.simple_stake_contract_addr,
      total_supply: fetchBTMintedAmountRsp.data.allTimeBTMintedAmount,
      ost_utility_balance: [[chainIntConstants.UTILITY_CHAIN_ID, fetchSTPrimeBalanceRsp.data.ostPrimeBalance]]
    };

    responseData.price_points = ostPrices.data;

    return Promise.resolve(responseHelper.successWithData(responseData));
  },

  /**
   *
   * Fetch BT Minted Amount Till Date
   *
   * @private
   *
   * @param {String} tokenSymbol - symbol for which minted amount is to be fetched
   * @param {String} conversionFactor - OST To BT conversionFactor
   *
   * @return {Promise<result>}
   *
   */
  fetchBTMintedAmount: async function(tokenSymbol, conversionFactor) {
    const oThis = this;

    const getStakedAmountObj = new GetStakedAmountKlass({
      client_id: oThis.clientId,
      token_symbol: tokenSymbol
    });

    const getStakedAmountRsp = await getStakedAmountObj.perform();

    const allTimeStakedAmount = new BigNumber(getStakedAmountRsp.data.allTimeStakedAmount);

    return Promise.resolve(
      responseHelper.successWithData({
        allTimeOSTStakedAmount: allTimeStakedAmount,
        allTimeBTMintedAmount: allTimeStakedAmount.mul(new BigNumber(conversionFactor))
      })
    );
  },

  /**
   *
   * Fetch ST Prime Balance
   *
   * @private
   *
   * @param {String} conversionFactor - OST To BT conversionFactor
   *
   * @return {Promise<result>}
   *
   */
  fetchSTPrimeBalance: async function(uuid) {
    const oThis = this;

    const balanceFetcherObj = new ucBalanceFetcherKlass({
      address_uuid: uuid,
      client_id: oThis.clientId,
      balance_types: ['ostPrime']
    });

    const balanceFetcherRsp = await balanceFetcherObj.perform();

    if (balanceFetcherRsp.isFailure()) {
      return Promise.reject(responseHelper.error(balanceFetcherRsp));
    }

    return Promise.resolve(
      responseHelper.successWithData({
        ostPrimeBalance: balanceFetcherRsp.data.ostPrime
      })
    );
  }
};

module.exports = GetBrandedTokenKlass;
