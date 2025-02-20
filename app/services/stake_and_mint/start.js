'use strict';

const rootPrefix = '../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  StakeAndMintRouterKlass = require(rootPrefix + '/lib/stake_and_mint/router'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

/**
 * Add new transaction kind constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id
 * @param {number} params.client_token_id - client token id
 * @param {number} params.token_symbol - token symbol
 * @param {object} params.stake_and_mint_params -
 * @param {decimal} params.stake_and_mint_params.bt_to_mint -
 * @param {decimal} params.stake_and_mint_params.st_prime_to_mint -
 * @param {string} params.stake_and_mint_params.client_eth_address -
 * @param {string} params.stake_and_mint_params.transfer_to_staker_tx_hash -
 *
 * @constructor
 *
 */
const StartStakeAndMintKlass = function(params) {
  var oThis = this;

  oThis.clientId = params.client_id;
  oThis.clientTokenId = params.client_token_id;
  oThis.tokenSymbol = params.token_symbol;
  oThis.stakeAndMintParams = params.stake_and_mint_params;
};

StartStakeAndMintKlass.prototype = {
  /**
   * Async Perform
   *
   * @return {promise<result>}
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
          internal_error_identifier: 's_s_sm_s_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    await oThis.validateAndSanitize();

    return new StakeAndMintRouterKlass({
      current_step: 'init',
      utility_chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
      value_chain_id: configStrategy.OST_VALUE_CHAIN_ID,
      token_symbol: oThis.tokenSymbol,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      stake_and_mint_params: oThis.stakeAndMintParams
    }).init();
  },

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  validateAndSanitize: function() {
    const oThis = this;

    if (!oThis.clientId || !oThis.clientTokenId || !oThis.tokenSymbol) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_sm_s_2',
          api_error_identifier: 'invalid_api_params',
          debug_options: {}
        })
      );
    }

    if (
      !oThis.stakeAndMintParams ||
      !oThis.stakeAndMintParams.client_eth_address ||
      !oThis.stakeAndMintParams.transaction_hash
    ) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_sm_s_3',
          api_error_identifier: 'invalid_api_params',
          debug_options: { stakeAndMintParams: oThis.stakeAndMintParams }
        })
      );
    }

    if (!oThis.stakeAndMintParams.bt_to_mint) {
      oThis.stakeAndMintParams.bt_to_mint = 0;
    }
    if (!oThis.stakeAndMintParams.st_prime_to_mint) {
      oThis.stakeAndMintParams.st_prime_to_mint = 0;
    }

    if (
      parseInt(oThis.stakeAndMintParams.bt_to_mint) === 0 &&
      parseInt(oThis.stakeAndMintParams.st_prime_to_mint) === 0
    ) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_sm_s_4',
          api_error_identifier: 'invalid_api_params',
          debug_options: { stakeAndMintParams: oThis.stakeAndMintParams }
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }
};
InstanceComposer.registerShadowableClass(StartStakeAndMintKlass, 'getStartStakeAndMintKlass');

module.exports = StartStakeAndMintKlass;
