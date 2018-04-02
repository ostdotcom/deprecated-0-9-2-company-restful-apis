"use strict";

const rootPrefix = '../../..'
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , StakeAndMintRouterKlass = require(rootPrefix + '/lib/stake_and_mint/router')
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
 *
 * @constructor
 *
 */
const StartStakeAndMintKlass = function (params) {

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
  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
        .catch(function(error) {
          if (responseHelper.isCustomResult(error)){
            return error;
          } else {
            logger.error(`${__filename}::perform::catch`);
            logger.error(error);

            return responseHelper.error("s_s_sm_s_1", "Unhandled result", null, {}, {});
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

    await oThis.validateAndSanitize();

    return new StakeAndMintRouterKlass({
      current_step: 'init',
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

    var oThis = this;

    if(!oThis.clientId || !oThis.clientTokenId || !oThis.tokenSymbol){
      return Promise.reject(responseHelper.error('s_sm_s_2', 'Invalid Params'));
    }

    if (!oThis.stakeAndMintParams || !oThis.stakeAndMintParams.bt_to_mint ||
        !oThis.stakeAndMintParams.st_prime_to_mint || !oThis.stakeAndMintParams.client_eth_address ||
        !oThis.stakeAndMintParams.transaction_hash) {
      return Promise.reject(responseHelper.error('s_sm_s_3', 'Invalid stakeAndMintParams', null, oThis.stakeAndMintParams));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = StartStakeAndMintKlass;