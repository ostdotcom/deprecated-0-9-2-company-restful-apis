"use strict";

/**
 *
 * Start contract Approve for airdrop contract of client <br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/contract_approve
 *
 */

const OpenStPaymentsKlass = require('@openstfoundation/openst-payments')
  , openStPaymentsAirdropManager = OpenStPaymentsKlass.airdropManager

const rootPrefix = '../../..'
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , clientBrandedToken = new ClientBrandedTokenKlass()
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  // , responseHelper = require(rootPrefix + '/lib/formatter/response')
;


/**
 * Add new transaction kind constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_airdrop_id - client airdrop id for which airdrop has to be done
 * @param {number} params.client_branded_token_id - client branded token id
 *
 * @constructor
 *
 */
const contractApproveKlass = function (params) {

  var oThis = this;

  oThis.clientBrandedTokenId = params.client_branded_token_id;
  oThis.clientAirdropId = params.client_airdrop_id;

};

contractApproveKlass.prototype = {

  perform: async function () {

    var oThis = this;

    const clientBrandedTokenSqlResponse = await clientBrandedToken.getById(oThis.clientBrandedTokenId);
    oThis.clientBrandedToken = clientBrandedTokenSqlResponse[0];

    var response = await openStPaymentsAirdropManager.approve(
      oThis.clientBrandedToken.airdropContractAddress,
      chainIntConstants.UTILITY_GAS_PRICE,
      chainIntConstants.UTILITY_CHAIN_ID,
      {returnType: "txReceipt"}
    );

    if (response.isFailure()) {
      logger.notify('am_ca_1','Error in contractApprove', response, {clientAirdropId:  oThis.clientAirdropId} );
    }

    return Promise.resolve(response);
  }

};

module.exports = contractApproveKlass;