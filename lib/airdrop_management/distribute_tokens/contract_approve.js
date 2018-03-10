"use strict";

/**
 *
 * Start contract Approve for airdrop contract of client <br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/contract_approve
 *
 */

const openStPayments = require('@openstfoundation/openst-payments')
  , openStPaymentsAirdropManager = openStPayments.airdropManager
;

const rootPrefix = '../../..'
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;


/**
 * Start contract Approve for airdrop contract of client constructor
 *
 * @param {object} params -
 * @param {number} params.client_airdrop_id - client airdrop id for which airdrop has to be done
 * @param {number} params.client_branded_token_id - client branded token id
 *
 * @constructor
 *
 */
const contractApproveKlass = function (params) {

  const oThis = this;

  oThis.clientBrandedTokenId = params.client_branded_token_id;
  oThis.clientAirdropId = params.client_airdrop_id;

  oThis.clientBrandedTokenObj = null;

};

contractApproveKlass.prototype = {

  perform: async function () {

    const oThis = this
      , managedAddress = new ManagedAddressKlass()
      , clientBrandedToken = new ClientBrandedTokenKlass()
    ;

    const clientBrandedTokenSqlResponse = await clientBrandedToken.getById(oThis.clientBrandedTokenId);
    oThis.clientBrandedTokenObj = clientBrandedTokenSqlResponse[0];

    // decrypt reserve passphrase
    const managedAddressSqlResponse = await managedAddress.getByIds([oThis.clientBrandedTokenObj.airdrop_holder_managed_address_id])
      , budgetHolderManagedAddressObj = managedAddressSqlResponse[0]
      , budgetHolderPassphrase = 'no_password'
    ;

    // TODO: Refill budget holder address & Worker, if balance lower then 0.05
    const response = await openStPaymentsAirdropManager.approve(
      oThis.clientBrandedTokenObj.airdrop_contract_addr,
      budgetHolderPassphrase,
      chainIntConstants.UTILITY_GAS_PRICE,
      chainIntConstants.UTILITY_CHAIN_ID,
      {returnType: "txReceipt", tag: ""}
    );

    if (response.isFailure()) {
      logger.notify('am_dt_ca_p_1', 'Error in contractApprove', response, {clientAirdropId: oThis.clientAirdropId});
    }

    return Promise.resolve(response);
  }

};

module.exports = contractApproveKlass;