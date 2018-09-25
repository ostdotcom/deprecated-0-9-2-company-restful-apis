'use strict';

/**
 * NOTE: This formatter will always format data as per latest version
 * Airdrop Entity Formatter.
 *
 * @module lib/formatter/entities/airdrop
 */

const rootPrefix = '../../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response');

/**
 *
 * @constructor
 *
 * @param {object} params - this is object with keys.
 * @param {string} params.id - airdrop uuid
 * @param {string} params.current_status - current airdrop status. eg: pending, failed, complete
 * @param {string} params.steps_complete - steps completed in the process. eg: users_identified, tokens_transferred, contract_approved, allocation_done
 */
const AirdropFormatterKlass = function(params) {
  const oThis = this;

  oThis.params = params;
};

AirdropFormatterKlass.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function() {
    const oThis = this,
      formattedUser = {};

    if (
      !oThis.params.hasOwnProperty('id') ||
      !oThis.params.hasOwnProperty('current_status') ||
      !oThis.params.hasOwnProperty('steps_complete')
    ) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_f_e_v0_u_1',
          api_error_identifier: 'entity_formatting_failed',
          debug_options: oThis.params
        })
      );
    }

    formattedUser.airdrop_uuid = oThis.params.id;
    formattedUser.current_status = oThis.params.current_status;
    formattedUser.steps_complete = oThis.params.steps_complete;

    return responseHelper.successWithData(formattedUser);
  }
};

module.exports = AirdropFormatterKlass;
