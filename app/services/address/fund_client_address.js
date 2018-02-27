"use strict";

const rootPrefix = '../../..'
  , openStPlatform = require('@openstfoundation/openst-platform')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , AddressEncryptorKlass = require(rootPrefix + '/lib/encryptors/addresses_encryptor')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
;

// Similarly, ST' will be refilled by Reserve Address:
// * Airdrop fund manager address
// * Worker address

/**
 * constructor
 *
 * @param {Object} params
 *
 * @constructor
 */
const FundClientAddressKlass = function (params) {

  const oThis = this;
  oThis.clientId = params.client_id;
  oThis.addrTypeToAddrMap = {};

};

FundClientAddressKlass.prototype = {

  _MIN_BALANCE: basicHelper.convertToWei(1),

  _TO_TRANSFER: basicHelper.convertToWei(1),

  /**
   * Perform
   *
   * @return {Result}
   */
  perform: async function () {
    const oThis = this;

    await oThis._setAddresses();

    await oThis._transferStPrimeIfNeeded();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  _setAddresses: async function() {
    const oThis = this;

    const clientBrandedTokenObj = new ClientBrandedTokenKlass();
    const clientBrandedTokens = await clientBrandedTokenObj.getByClientId(oThis.clientId);

    // assuming that the last token is the only token.
    const brandedToken = clientBrandedTokens[clientBrandedTokens.length - 1];

    const managedAddressObj = new ManagedAddressKlass();
    const managedAddresses = await managedAddressObj.getByIds([
      brandedToken.reserve_managed_address_id,
      brandedToken.worker_managed_address_id,
      brandedToken.airdrop_holder_managed_address_id
    ]);

    for(var i=0; i<managedAddresses.length; i++){
      var addressObj = managedAddresses[i];
      oThis.addrTypeToAddrMap[addressObj.address_type] = addressObj;
    }
    return Promise.resolve(responseHelper.successWithData({}))
  },

  _transferStPrimeIfNeeded: async function(){

    const oThis = this
      , managedAddressObj = new ManagedAddressKlass()
      , reserveAddrObj = oThis.addrTypeToAddrMap[managedAddressObj.invertedAddressTypes[managedAddressesConst.reserveAddressType]]
      , workerAddrObj = oThis.addrTypeToAddrMap[managedAddressObj.invertedAddressTypes[managedAddressesConst.workerAddressType]]
      , airdropHolderAddrObj = oThis.addrTypeToAddrMap[managedAddressObj.invertedAddressTypes[managedAddressesConst.airdropHolderAddressType]]
    ;

    // check st prime balance
    // notify if balance

    const addressEncryptor = new AddressEncryptorKlass(oThis.clientId);
    const reservePassphraseD = await addressEncryptor.decrypt(reserveAddrObj.passphrase);

    if(await oThis._isTransferRequired(workerAddrObj.ethereum_address)) {
      //transfer to worker
      await oThis._transferBalance(reserveAddrObj.ethereum_address, reservePassphraseD,
        workerAddrObj.ethereum_address, oThis._TO_TRANSFER)
    }

    if(await oThis._isTransferRequired(airdropHolderAddrObj.ethereum_address)){
      //transfer to airdrop holder
      await oThis._transferBalance(reserveAddrObj.ethereum_address, reservePassphraseD,
        airdropHolderAddrObj.ethereum_address, oThis._TO_TRANSFER)
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Get Ether Balance of an Address
   *
   * @param {string} ethereumAddress - Address to check balance for
   *
   * @returns {promise<boolean>}
   * @private
   */
  _isTransferRequired: async function (ethereumAddress) {
    const oThis = this
      , fetchBalanceObj = new openStPlatform.services.balance.simpleTokenPrime({address: ethereumAddress})
      , balanceResponse = await fetchBalanceObj.perform()
    ;

    if (balanceResponse.isFailure()) {
      logger.notify('e_fa_e_ceb_1', "Error in fetching balance of Address - " + ethereumAddress, balanceResponse);
      throw "Error in fetching balance of Address - " + ethereumAddress;
    }

    const ethBalanceBigNumber = basicHelper.convertToBigNumber(balanceResponse.data.balance);

    if(ethBalanceBigNumber.lessThan(oThis._MIN_BALANCE)){
      return Promise.resolve(true);
    } else {
      return Promise.resolve(false);
    }
  },

  /**
   * Transfer ST Prime to an address
   *
   * @param {string} reserveAddress - Reserve address
   * @param {string} reservePassphrase - Reserve address passphrase
   * @param {string} recipientAddress - Address to transfer ST Prime to
   * @param {string} transferAmountInWei - Amount to be transferred to the given address in Wei
   *
   * @returns {promise<result>}
   * @private
   */
  _transferBalance: async function (reserveAddress, reservePassphrase, recipientAddress, transferAmountInWei) {

    const oThis = this
    ;

    const transferSTPrimeBalanceObj = new openStPlatform.services.transaction.transfer.simpleTokenPrime({
      sender_address: reserveAddress,
      sender_passphrase: reservePassphrase,
      recipient_address: recipientAddress,
      amount_in_wei: transferAmountInWei,
      options: {returnType: 'txReceipt', tag: 'GasRefill'}
    });

    const transferResponse = await transferSTPrimeBalanceObj.perform();

    if (transferResponse.isFailure()) {
      logger.notify('e_fa_e_teb_1', "Error in transfer of " + transferAmountInWei + "Wei Eth to Address - " + recipientAddress, transferResponse);
      return Promise.resolve(transferResponse);
    }

    return Promise.resolve(transferResponse);
  }

};

module.exports = FundClientAddressKlass;