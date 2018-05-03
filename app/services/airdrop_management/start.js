"use strict";

/**
 * Schedule new airdrop task.
 *
 * @module app/services/airdrop_management/start
 */

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , AllocateAirdropKlass = require(rootPrefix + '/lib/allocate_airdrop/start_airdrop')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/**
 * Add new transaction kind constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id (Mandatory) - client id
 * @param {Decimal} params.amount (Mandatory) - number of tokens to be airdropped to each shortlisted address.
 * @param {Boolean} params.airdropped (optional) - true: already airdropped, false: never airdropped
 * @param {string} params.user_ids (optional) - specific set of users can get shortlisted for airdrop.
 *
 * @constructor
 *
 */
const StartAirdropKlass = function (params) {

  var oThis = this;

  oThis.clientId = params.client_id;
  oThis.airdropAmount = params.amount;
  oThis.airdropped = params.airdropped;
  oThis.userIds = params.user_ids;
  oThis.airdropUserListType = null;

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

            return responseHelper.error({
              internal_error_identifier: 's_am_s_1',
              api_error_identifier: 'unhandled_catch_response',
              debug_options: {}
            });
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

    return new AllocateAirdropKlass({
        client_id: oThis.clientId,
        airdrop_params: {
          airdrop_amount: oThis.airdropAmount,
          airdrop_user_list_type: oThis.airdropUserListType,
          user_ids: oThis.userIds
        }
    }).perform()

  },

  /**
   * Validate and Sanitize
   *
   * @return {promise<result>}
   */
  validateAndSanitize: function() {

    var oThis = this;

    if(!oThis.clientId){
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_am_s_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_client_id']
        debug_options: {}
      }));
    }

    if (!oThis.airdropAmount) {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_am_s_3',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['invalid_airdrop_amount']
        debug_options: {}
      }));
    }

    if(oThis.airdropped == 'true'){
      oThis.airdropUserListType = clientAirdropConst.everAirdroppedAddressesAirdropListType;
    } else if (oThis.airdropped == 'false'){
      oThis.airdropUserListType = clientAirdropConst.neverAirdroppedAddressesAirdropListType;
    } else {
      oThis.airdropUserListType = clientAirdropConst.allAddressesAirdropListType;
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = StartAirdropKlass;