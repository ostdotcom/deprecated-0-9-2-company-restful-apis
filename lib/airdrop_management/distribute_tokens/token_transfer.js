"use strict";

/**
 *
 * Start airdrop token transfer from reserve address to budget holder address.<br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/token_transfer
 *
 */

const OpenStPaymentsModule = require('@openstfoundation/openst-payments')
  , openStPaymentsAirdropManager = OpenStPaymentsModule.airdropManager
;

const rootPrefix = '../../..'
  , ClientAirdropDetailsKlass = require(rootPrefix + '/app/models/client_airdrop_details')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , AddressEncryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
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

  oThis.clientBrandedTokenObj = null;

};

tokenTransferKlass.prototype = {

  perform: async function () {

    const oThis = this
      , clientAirdropDetails = new ClientAirdropDetailsKlass()
      , managedAddress = new ManagedAddressKlass()
      , clientBrandedToken = new ClientBrandedTokenKlass()
    ;

    // fetch branded token details
    oThis.clientBrandedTokenObj = await clientBrandedToken.getById(oThis.client_branded_token_id)[0];

    // decrypt reserve passphrase
    const managedAddressObj = await managedAddress.getByIds([oThis.clientBrandedTokenObj.reserve_managed_address_id])[0]
      , encrObj = new AddressEncryptorKlass(managedAddressObj.client_id)
      , managedAddressPassphrase = await encrObj.decrypt(managedAddressObj.passphrase)
    ;

    // TODO: check the limit of sum from DB. what will happen when amount is too big.
    const totalAmountInWei = await clientAirdropDetails.getTotalTransferAmount(oThis.clientAirdropId)[0].totalAmountInWei;

    const response = await openStPaymentsAirdropManager.transfer(
      managedAddressObj.ethereum_address,
      managedAddressPassphrase,
      oThis.clientBrandedTokenObj.airdropContractAddress,
      basicHelper.formatWeiToString(totalAmountInWei),
      chainIntConstants.UTILITY_GAS_PRICE,
      chainIntConstants.UTILITY_CHAIN_ID,
      {returnType: "txReceipt"}
    );

    if (response.isFailure()) {
      logger.notify('am_dt_tt_p_1', 'Error in tokenTransfer', response, {clientAirdropId:  oThis.clientAirdropId} );
    }

    return Promise.resolve(response);
  }

};

module.exports = tokenTransferKlass;