"use strict";

/**
 *
 * Start Airdrop Token Transfer Step for a client Airdrop.<br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/token_transfer
 *
 */

const OpenStPaymentsKlass = require('@openstfoundation/openst-payments')
  , openStPaymentsAirdropManager = OpenStPaymentsKlass.airdropManager
;

const rootPrefix = '../../..'
  , clientAirdropDetailsKlass = require(rootPrefix + '/app/models/client_airdrop_details')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , clientBrandedToken = new ClientBrandedTokenKlass()
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , ManagedAddress = new ManagedAddressKlass()
  , AddressEncryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor')
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
const tokenTransferKlass = function (params) {

  var oThis = this;

  oThis.clientBrandedTokenId = params.client_branded_token_id;
  oThis.clientAirdropId = params.client_airdrop_id;

};

tokenTransferKlass.prototype = {

  perform: async function () {

    var oThis = this
      , clientAirdropDetails = new clientAirdropDetailsKlass()
    ;

    oThis.clientBrandedTokenObj = await clientBrandedToken.getById(oThis.client_branded_token_id)[0];

    const managedAddressObj = ManagedAddress.getByIds([oThis.clientBrandedTokenObj.reserve_managed_address_id])[0]
      , encrObj = new AddressEncryptorKlass(managedAddressObj.client_id)
    ;

    var managedAddressPassphrase = await encrObj.decrypt(managedAddressObj.passphrase);

    var totalAmountInWei = await oThis.clientAirdropDetails.getTotalTransferAmount(oThis.clientAirdropId)[0].totalAmountInWei;

    var response = await openStPaymentsAirdropManager.transfer(
      managedAddressObj.ethereum_address,
      managedAddressPassphrase,
      oThis.clientBrandedTokenObj.airdropContractAddress,
      totalAmountInWei,
      chainIntConstants.UTILITY_GAS_PRICE,
      chainIntConstants.UTILITY_CHAIN_ID,
      {returnType: "txReceipt"}
    );

    if (response.isFailure()) {
      logger.notify('am_tt_1','Error in tokenTransfer', response, {clientAirdropId:  oThis.clientAirdropId} );
    }

    return Promise.resolve(response);
  }

};

module.exports = tokenTransferKlass;