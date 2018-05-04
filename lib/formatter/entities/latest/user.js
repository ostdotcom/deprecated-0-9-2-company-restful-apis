"use strict";

/**
 * NOTE: This formatter will always format data as per latest version
 * User Entity Formatter. 
 *
 * @module lib/formatter/entities/user
 */

const rootPrefix = "../../.."
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
;

/**
 *
 * @constructor
 *
 * @param {object} params - this is object with keys.
 * @param {object} params.uuid - uuid
 * @param {object} params.address - address
 * @param {object} params.name - name
 * @param {object} params.total_airdropped_tokens - airdropped_tokens
 * @param {object} params.token_balance - token_balance
 */
const UserFormatterKlass = function(params){

  const oThis = this;

  oThis.params = params;

};

UserFormatterKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function () {

    const oThis = this
        , formattedUser = {}
    ;

    if (!oThis.params.hasOwnProperty(uuid) || !oThis.params.hasOwnProperty(address)
        || !oThis.params.hasOwnProperty(name) || !oThis.params.hasOwnProperty(total_airdropped_tokens)
        || !oThis.params.hasOwnProperty(token_balance)) {

      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'l_f_e_l_u_1',
        api_error_identifier: 'entity_formatting_failed',
        debug_options: oThis.params
      }));

    }

    formattedUser.id = oThis.params.uuid;
    formattedUser.addresses = [
      [chainIntConstants.UTILITY_CHAIN_ID, oThis.params.address]
    ];
    formattedUser.name = oThis.params.name;
    formattedUser.airdropped_tokens = oThis.params.total_airdropped_tokens;
    formattedUser.token_balance = oThis.params.token_balance;

    return responseHelper.successWithData(formattedUser);

  }

}

module.exports = UserFormatterKlass;