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
 * @param {number} params.token_symbol - token symbol
 * @param {object} params.list_type -
 * @param {object} params.amount -
 *
 * @constructor
 *
 */
const StartAirdropKlass = function (params) {

  var oThis = this;

  oThis.clientId = params.client_id;
  oThis.tokenSymbol = params.token_symbol;
  oThis.airdropAmount = params.amount;
  oThis.airdropUserListType = params.list_type;

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
      airdrop_params: {
        airdrop_amount: oThis.airdropAmount,
        airdrop_user_list_type: oThis.airdropUserListType
      }
    }).init();

  },

  /**
   * Async Perform
   *
   * @return {promise<result>}
   */
  validateAndSanitize: function() {

    var oThis = this;

    if(!oThis.clientId || !oThis.tokenSymbol){
      return Promise.reject(responseHelper.error('s_am_s_2', 'Invalid Params'));
    }

    if (!oThis.airdropAmount || !oThis.airdropUserListType) {
      return Promise.reject(responseHelper.error('s_am_s_3', 'Invalid airdropParams', null, oThis.airdropParams));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

}

module.exports = StartAirdropKlass;