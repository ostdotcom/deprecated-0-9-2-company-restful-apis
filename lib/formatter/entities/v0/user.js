"use strict";

/**
 * NOTE: This formatter will always format data as per latest version
 * User Entity Formatter. 
 *
 * @module lib/formatter/entities/user
 */

const rootPrefix = "../../../.."
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 *
 * @constructor
 *
 * @param {object} params - this is object with keys.
 * @param {object} params.uuid - uuid
 * @param {object} params.addresses - addresses array
 * @param {object} params.name - name
 * @param {object} params.airdropped_tokens - airdropped_tokens
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

    if (!oThis.params.hasOwnProperty('id') || !oThis.params.hasOwnProperty('addresses') || !oThis.params.hasOwnProperty('name') ||
        !oThis.params.hasOwnProperty('airdropped_tokens') || !oThis.params.hasOwnProperty('token_balance')) {

      return Promise.reject(responseHelper.error({
        internal_error_identifier: 'l_f_e_v0_u_1',
        api_error_identifier: 'entity_formatting_failed',
        debug_options: oThis.params
      }));

    }

    formattedUser.uuid = oThis.params.id;
    formattedUser.id = oThis.params.id;
    formattedUser.name = oThis.params.name;
    formattedUser.total_airdropped_tokens = oThis.params.airdropped_tokens;
    formattedUser.token_balance = oThis.params.token_balance;

    return responseHelper.successWithData(formattedUser);

  }

}

module.exports = UserFormatterKlass;