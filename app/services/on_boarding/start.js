"use strict";

const rootPrefix = '../../..'
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , OnBoardingRouterKlass = require(rootPrefix + 'lib/on_boarding/router.js')
    , basicHelper = require(rootPrefix + '/helpers/basic')
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

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
 * @param {object} params.airdrop_params -
 * @param {object} params.airdrop_params.airdrop_amount -
 * @param {object} params.airdrop_params.airdrop_user_list_type -
 *
 * @constructor
 *
 */
const StartOnBoardingKlass = function (params) {

  var oThis = this;

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
  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
        .catch(function(error) {
          if (responseHelper.isCustomResult(error)){
            return error;
          } else {
            logger.error(`${__filename}::perform::catch`);
            logger.error(error);

            return responseHelper.error("s_sam_gsa_1", "Unhandled result", null, {}, {});
          }
        })
  },

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function() {

    const oThis = this;

    oThis.validateAndSanitize();

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

    var oThis = this;

    if(!oThis.clientId || !oThis.clientTokenId || !oThis.tokenSymbol){
      return Promise.reject(responseHelper.error('sam_gsa_1', 'Invalid Params'));
    }

    if (!oThis.stakeAndMintParams || !oThis.stakeAndMintParams.bt_to_mint ||
        !oThis.stakeAndMintParams.st_prime_to_mint || !oThis.stakeAndMintParams.client_eth_address ||
        !oThis.stakeAndMintParams.transaction_hash) {
      return Promise.reject(responseHelper.error('sam_gsa_2', 'Invalid stakeAndMintParams', null, oThis.stakeAndMintParams));
    }

    if (!oThis.airdropParams || !oThis.airdrop_amount || !oThis.airdrop_user_list_type) {
      return Promise.reject(responseHelper.error('sam_gsa_3', 'Invalid airdropParams', null, oThis.airdropParams));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

}

module.exports = StartOnBoardingKlass;