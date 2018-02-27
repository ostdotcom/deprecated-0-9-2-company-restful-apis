"use strict";

/**
 *
 * Start airdrop token transfer from reserve address to budget holder address.<br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/token_transfer
 *
 */

const openStPayments = require('@openstfoundation/openst-payments')
  , openStPaymentsAirdropManager = openStPayments.airdropManager
  , openStPlatform = require('@openstfoundation/openst-platform')
;

const rootPrefix = '../../..'
  , ClientAirdropDetailsKlass = require(rootPrefix + '/app/models/client_airdrop_details')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , AddressEncryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;


/**
 * Start airdrop token transfer from reserve address to budget holder address constructor
 *
 * @param {object} params -
 * @param {number} params.client_airdrop_id - client airdrop id for which airdrop has to be done
 * @param {number} params.client_branded_token_id - client branded token id
 *
 * @constructor
 */
const tokenTransferKlass = function (params) {

  const oThis = this;

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
    const clientBrandedTokenSqlResponse = await clientBrandedToken.getById(oThis.clientBrandedTokenId);
    oThis.clientBrandedTokenObj = clientBrandedTokenSqlResponse[0];

    // decrypt reserve passphrase
    const managedAddressSqlResponse = await managedAddress.getByIds([oThis.clientBrandedTokenObj.reserve_managed_address_id])
      , managedAddressObj = managedAddressSqlResponse[0]
      , encrObj = new AddressEncryptorKlass(oThis.clientBrandedTokenObj.client_id)
      , managedAddressPassphrase = await encrObj.decrypt(managedAddressObj.passphrase)
    ;

    // Get total tokens to be transfered from reserve to budget holder
    const totalAmountSqlResponse = await clientAirdropDetails.getTotalTransferAmount(oThis.clientAirdropId)
      , totalAmountInWei = basicHelper.formatWeiToString(totalAmountSqlResponse[0].totalAmountInWei)
    ;

    const refillResponse = await oThis._checkAndRefillSTPrimeBalance(managedAddressObj.ethereum_address, managedAddressPassphrase);

    if (refillResponse.isFailure()) {
      logger.notify('am_dt_tt_p_1', 'Error in checkAnsRefillSTPrimeBalance', refillResponse, {clientAirdropId: oThis.clientAirdropId});
      return Promise.resolve(refillResponse);
    }

    // Initiate transfer
    const response = await openStPaymentsAirdropManager.transfer(
      managedAddressObj.ethereum_address,
      managedAddressPassphrase,
      oThis.clientBrandedTokenObj.airdrop_contract_addr,
      totalAmountInWei,
      chainIntConstants.UTILITY_GAS_PRICE,
      chainIntConstants.UTILITY_CHAIN_ID,
      {returnType: "txReceipt"}
    );

    if (response.isFailure()) {
      logger.notify('am_dt_tt_p_2', 'Error in tokenTransfer', response, {clientAirdropId: oThis.clientAirdropId});
    }

    return Promise.resolve(response);
  },

  /**
   * Check ST Prime Balance of Budget Holder and worker Address and refill if nedded
   *
   * @param {String} reservedAddress - ethereum address of clients reserved address
   * @param {String} reservedAddressPassphrase - passphrase of clients reserved address
   *
   * @return {promise<result>}
   *
   */
  _checkAndRefillSTPrimeBalance: async function (reservedAddress, reservedAddressPassphrase) {

    const oThis = this
      , managedAddress = new ManagedAddressKlass()
    ;

    // get budget holder address
    const managedAddressSqlResponse = await managedAddress.getByIds([oThis.clientBrandedTokenObj.airdrop_holder_managed_address_id])
      , budgetHoldermanagedAddressObj = managedAddressSqlResponse[0]
    ;

    // fetch ST Prime balance of budget holder
    const fetchBalanceObj = new openStPlatform.services.balance.simpleTokenPrime({'address': budgetHoldermanagedAddressObj.ethereum_address});
    const balanceResponse = await fetchBalanceObj.perform();


    if (balanceResponse.isFailure()) {
      logger.notify('am_dt_tt_carstpb_1', "Error in fetching ST Prime balance of budget holder Address for Airdrop ID - " + oThis.clientAirdropObj.id);
      return Promise.resolve(balanceResponse);
    }

    // transfer ST Primen if less than .05
    if (parseInt(balanceResponse.data.balance) >= 50000000000000000) {
      return Promise.resolve(balanceResponse);
    }

    const serviceObj = new openStPlatform.services.transaction.transfer.simpleTokenPrime({
        sender_address: reservedAddress,
        sender_passphrase: reservedAddressPassphrase,
        recipient_address: budgetHoldermanagedAddressObj.ethereum_address,
        amount_in_wei: 100000000000000000,
        options: {returnType: 'txReceipt', tag: 'GasRefill'}
      }
    );

    const response = await serviceObj.perform();

    if (response.isFailure()) {
      logger.notify('am_dt_tt_carstpb_2', 'Error in checkAndRefillSTPrimeBalance', response, {clientAirdropId: oThis.clientAirdropId});
    }

    return Promise.resolve(response);
  }

};

module.exports = tokenTransferKlass;