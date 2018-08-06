'use strict';

/**
 * Fetch Chain Interaction Params
 *
 * @module app/services/on_boarding/fetch_chain_interact_params
 *
 */

const rootPrefix = '../../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * Fetch Params using which FE could interact with our chains
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id for whom users are to be created.
 *
 */
const FetchChainInteractionParams = function(params) {
  this.clientId = params.client_id;
};

FetchChainInteractionParams.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'ob_fcip_2',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  /**
   * Perform<br><br>
   *
   * @return {result} - returns an object of Result
   *
   */
  asyncPerform: function() {
    const oThis = this;

    if (!oThis.clientId) {
      return Promise.resolve(
        responseHelper.paramValidationError({
          internal_error_identifier: 'ob_fcip_1',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['missing_client_id'],
          debug_options: {}
        })
      );
    }

    var responseData = {
      utility_chain_id: chainInteractionConstants.UTILITY_CHAIN_ID,
      utility_chain_geth_rpc_provider: chainInteractionConstants.UTILITY_GETH_RPC_PROVIDER,
      utility_chain_geth_ws_provider: chainInteractionConstants.UTILITY_GETH_WS_PROVIDER,
      value_chain_id: chainInteractionConstants.VALUE_CHAIN_ID,
      value_chain_geth_rpc_provider: chainInteractionConstants.VALUE_GETH_RPC_PROVIDER,
      value_chain_geth_ws_provider: chainInteractionConstants.VALUE_GETH_WS_PROVIDER,
      simple_token_contract_addr: chainInteractionConstants.SIMPLE_TOKEN_CONTRACT_ADDR,
      staker_addr: chainInteractionConstants.STAKER_ADDR
    };

    return Promise.resolve(responseHelper.successWithData(responseData));
  }
};

InstanceComposer.registerShadowableClass(FetchChainInteractionParams, 'getFetchChainInteractionParams');

module.exports = FetchChainInteractionParams;
