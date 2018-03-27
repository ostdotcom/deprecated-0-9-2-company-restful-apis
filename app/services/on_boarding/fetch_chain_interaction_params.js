"use strict";

/**
 * Fetch Chain Interaction Params
 *
 * @module app/services/on_boarding/fetch_chain_interact_params
 *
 */

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , openStPlatform = require('@openstfoundation/openst-platform')
;

/**
 * Fetch Params using which FE could interact with our chains
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom users are to be created.
 *
 */
const FetchChainInteractionParams = function (params) {

  this.clientId = params.client_id;

};

FetchChainInteractionParams.prototype = {

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch((error) => {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("ob_fcip_2", "Unhandled result", null, {}, {});
        }
      })
  },

  /**
   * Perform<br><br>
   *
   * @return {result} - returns an object of Result
   *
   */
  asyncPerform: function () {

    const oThis = this;

    if (!oThis.clientId) {
      return Promise.resolve(responseHelper.error('ob_fcip_1', 'missing clientId'));
    }

    var responseData = {

      utility_chain_id: chainInteractionConstants.UTILITY_CHAIN_ID,
      utility_chain_geth_rpc_provider: chainInteractionConstants.UTILITY_GETH_RPC_PROVIDER,
      value_chain_id: chainInteractionConstants.VALUE_CHAIN_ID,
      value_chain_geth_rpc_provider: chainInteractionConstants.VALUE_GETH_RPC_PROVIDER,
      simple_token_contract_addr: chainInteractionConstants.SIMPLE_TOKEN_CONTRACT_ADDR,
      staker_addr: chainInteractionConstants.STAKER_ADDR

    };

    return Promise.resolve(responseHelper.successWithData(responseData));

  }

};

module.exports = FetchChainInteractionParams;