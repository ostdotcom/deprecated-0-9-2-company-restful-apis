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
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , AddressEncryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor')
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
      , encrObj = new AddressEncryptorKlass(oThis.clientBrandedTokenObj.client_id)
      , budgetHolderPassphrase = await encrObj.decrypt(budgetHolderManagedAddressObj.passphrase)
    ;

    // TODO: Refill budget holder address & Worker, if balance lower then 0.05

    var response = await openStPaymentsAirdropManager.approve(
      oThis.clientBrandedTokenObj.airdrop_contract_addr,
      budgetHolderPassphrase,
      chainIntConstants.UTILITY_GAS_PRICE,
      chainIntConstants.UTILITY_CHAIN_ID,
      {returnType: "txReceipt"}
    );

    if (response.isFailure()) {
      logger.notify('am_dt_ca_p_1','Error in contractApprove', response, {clientAirdropId:  oThis.clientAirdropId} );
    }

    return Promise.resolve(response);
  }

};

module.exports = contractApproveKlass;