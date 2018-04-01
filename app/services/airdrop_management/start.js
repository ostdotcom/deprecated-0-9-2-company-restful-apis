"use strict";

const rootPrefix = '../../..'
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , AirdropRouterKlass = require(rootPrefix + '/lib/allocate_airdrop/router')
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
 * @param {object} params.airdrop_params -
 * @param {object} params.airdrop_params.airdrop_amount -
 * @param {object} params.airdrop_params.airdrop_user_list_type -
 *
 * @constructor
 *
 */
const StartAirdropKlass = function (params) {

  var oThis = this;

  oThis.clientId = params.client_id;
  oThis.clientTokenId = params.client_token_id;
  oThis.tokenSymbol = params.token_symbol;
  oThis.airdropParams = params.airdrop_params;

};

StartAirdropKlass.prototype = {

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

            return responseHelper.error("s_am_s_1", "Unhandled result", null, {}, {});
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

    return new AirdropRouterKlass({
      current_step: 'init',
      token_symbol: oThis.tokenSymbol,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
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
      return Promise.reject(responseHelper.error('s_am_s_2', 'Invalid Params'));
    }

    if (!oThis.airdropParams || !oThis.airdropParams.airdrop_amount || !oThis.airdropParams.airdrop_user_list_type) {
      return Promise.reject(responseHelper.error('s_am_s_3', 'Invalid airdropParams', null, oThis.airdropParams));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

}

module.exports = StartAirdropKlass;