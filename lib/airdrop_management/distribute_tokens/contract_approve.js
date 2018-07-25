'use strict';

/**
 *
 * Start contract Approve for airdrop contract of client <br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/contract_approve
 *
 */

const openStPayments = require('@openstfoundation/openst-payments'),
  AirdropManagerApproveKlass = openStPayments.services.airdropManager.approve;

const rootPrefix = '../../..',
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

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
const contractApproveKlass = function(params) {
  const oThis = this;

  oThis.clientBrandedTokenId = params.client_branded_token_id;
  oThis.clientAirdropId = params.client_airdrop_id;

  oThis.clientBrandedTokenObj = null;
};

contractApproveKlass.prototype = {
  perform: async function() {
    const oThis = this;

    const clientBrandedTokenSqlResponse = await new ClientBrandedTokenModel().getById(oThis.clientBrandedTokenId);
    oThis.clientBrandedTokenObj = clientBrandedTokenSqlResponse[0];

    // decrypt reserve passphrase
    const managedAddressSqlResponse = await new ManagedAddressModel().getByIds([
        oThis.clientBrandedTokenObj.airdrop_holder_managed_address_id
      ]),
      budgetHolderManagedAddressObj = managedAddressSqlResponse[0],
      budgetHolderPassphrase = 'no_password';

    // TODO: Refill budget holder address & Worker, if balance lower then 0.05

    const airdropManagerApproveObj = new AirdropManagerApproveKlass({
      airdrop_contract_address: oThis.clientBrandedTokenObj.airdrop_contract_addr,
      airdrop_budget_holder_passphrase: budgetHolderPassphrase,
      gas_price: chainIntConstants.UTILITY_GAS_PRICE,
      chain_id: chainIntConstants.UTILITY_CHAIN_ID,
      options: { tag: 'airdrop.approve', returnType: 'txReceipt' }
    });

    const response = await airdropManagerApproveObj.perform();

    if (response.isFailure()) {
      logger.notify('am_dt_ca_p_1', 'Error in contractApprove', response, { clientAirdropId: oThis.clientAirdropId });
    }

    return Promise.resolve(response);
  }
};

module.exports = contractApproveKlass;
