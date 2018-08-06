'use strict';

const rootPrefix = '../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  OnBoardingRouterKlass = require(rootPrefix + '/lib/on_boarding/router'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * Add new transaction kind constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id
 * @param {number} params.client_token_id - client token id
 * @param {String} params.token_symbol - token symbol
 * @param {object} params.stake_and_mint_params -
 * @param {float} params.stake_and_mint_params.bt_to_mint -
 * @param {float} params.stake_and_mint_params.st_prime_to_mint -
 * @param {string} params.stake_and_mint_params.client_eth_address -
 * @param {string} params.stake_and_mint_params.transfer_to_staker_tx_hash -
 * @param {object} params.airdrop_params -
 * @param {object} params.airdrop_params.airdrop_amount -
 * @param {object} params.airdrop_params.airdrop_user_list_type -
 *
 * @constructor
 *
 */
const StartOnBoardingKlass = function(params) {
  const oThis = this;

  oThis.clientId = params.client_id;
  oThis.clientTokenId = params.client_token_id;
  oThis.tokenSymbol = params.token_symbol;
  oThis.stakeAndMintParams = params.stake_and_mint_params;
  oThis.airdropParams = params.airdrop_params;
};

StartOnBoardingKlass.prototype = {
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
          internal_error_identifier: 's_ob_s_1',
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
    const oThis = this;

    await oThis.validateAndSanitize();

    return new OnBoardingRouterKlass({
      current_step: 'init',
      token_symbol: oThis.tokenSymbol,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      stake_and_mint_params: oThis.stakeAndMintParams,
      airdrop_params: oThis.airdropParams
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
          internal_error_identifier: 's_ob_s_2',
          api_error_identifier: 'invalid_api_params',
          debug_options: {}
        })
      );
    }

    if (
      !oThis.stakeAndMintParams ||
      !oThis.stakeAndMintParams.bt_to_mint ||
      !oThis.stakeAndMintParams.st_prime_to_mint ||
      !oThis.stakeAndMintParams.client_eth_address ||
      !oThis.stakeAndMintParams.transaction_hash
    ) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_ob_s_3',
          api_error_identifier: 'invalid_api_params',
          debug_options: { stakeAndMintParams: oThis.stakeAndMintParams }
        })
      );
    }

    if (!oThis.airdropParams || !oThis.airdropParams.airdrop_amount || !oThis.airdropParams.airdrop_user_list_type) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 's_ob_s_4',
          api_error_identifier: 'invalid_api_params',
          debug_options: { airdropParams: oThis.airdropParams }
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

InstanceComposer.registerShadowableClass(StartOnBoardingKlass, 'getStartOnBoarding');

module.exports = StartOnBoardingKlass;
