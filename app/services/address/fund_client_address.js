"use strict";

/**
 * Refill ST Prime to client specific addresses by Reserve.
 *
 * <br><br>Reserve refills ST Prime to following client specific addresses:
 * <ol>
 *   <li>Airdrop fund manager address</li>
 *   <li>Worker address</li>
 * </ol>
 *
 * @module app/services/address/fund_client_address
 */

const rootPrefix = '../../..'
  , openStPlatform = require('@openstfoundation/openst-platform')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , ClientWorkerManagedAddressIdsKlass = require(rootPrefix + '/app/models/client_worker_managed_address_id')
  , clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id')
  , ClientActiveWorkerUuidCacheKlass = require(rootPrefix + '/lib/cache_management/client_active_worker_uuid')
;

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

  oThis.reserveAddrObj = null;
  oThis.airdropHolderAddrObj = null;
  oThis.workerAddrObjs = [];

};

FundClientAddressKlass.prototype = {

  /**
   * Minimum balance
   *
   * @constant
   * @private
   */
  _MIN_BALANCE: basicHelper.convertToWei(1),

  /**
   * Minimum balance for reserve address after which alerts will be sent
   *
   * @constant
   * @private
   */
  _MIN_ALERT_BALANCE_RESERVE: basicHelper.convertToWei(10),

  /**
   * Minimum balance for reserve address
   *
   * @constant
   * @private
   */
  _MIN_AVAILABLE_BALANCE_RESERVE: basicHelper.convertToWei(1.1),

  /**
   * To Transfer Balance
   *
   * @constant
   * @private
   */
  _TO_TRANSFER: basicHelper.convertToWei(1),


  /**
   * perform
   *
   * @return {Result}
   */

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_a_fca_2", "Unhandled result", [], {sendErrorEmail: false});
        }
      });
  },

  /**
   * asyncPerform
   *
   * @return {Result}
   */
  asyncPerform: async function () {
    const oThis = this;

    await oThis._setAddresses();

    var r = await oThis._checkBalanceOfReserveAddress();
    if (r.isFailure()) {
      return Promise.resolve(r);
    }

    await oThis._transferStPrimeIfNeeded();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Set addresses
   *
   * @returns {promise<result>}
   * @private
   */
  _setAddresses: async function() {

    const oThis = this;

    const clientBrandedTokenObj = new ClientBrandedTokenKlass();
    const clientBrandedTokens = await clientBrandedTokenObj.getByClientId(oThis.clientId);

    // assuming that the last token is the only token.
    const brandedToken = clientBrandedTokens[clientBrandedTokens.length - 1]
        , clientWorkerAddrObj = new ClientWorkerManagedAddressIdsKlass()
        , existingWorkerManagedAddresses = await clientWorkerAddrObj.getActiveByClientId(oThis.clientId)
        , workerManagedAddressIds = []
    ;

    for(var i=0; i<existingWorkerManagedAddresses.length; i++) {
      workerManagedAddressIds.push(existingWorkerManagedAddresses[i].managed_address_id);
    }

    const managedAddressObj = new ManagedAddressKlass()
        , reserveAddressType = managedAddressObj.invertedAddressTypes[managedAddressesConst.reserveAddressType]
        , airdropHolderAddressType = managedAddressObj.invertedAddressTypes[managedAddressesConst.airdropHolderAddressType]
        , workerAddressType = managedAddressObj.invertedAddressTypes[managedAddressesConst.workerAddressType]
    ;

    const managedAddresses = await managedAddressObj.getByIds([
      brandedToken.reserve_managed_address_id,
      brandedToken.airdrop_holder_managed_address_id
    ].concat(workerManagedAddressIds));

    for(var i=0; i<managedAddresses.length; i++){
      var addressObj = managedAddresses[i];
      if (addressObj.address_type == reserveAddressType) {
        oThis.reserveAddrObj = addressObj;
      } else if (addressObj.address_type == airdropHolderAddressType) {
        oThis.airdropHolderAddrObj = addressObj;
      } else if (addressObj.address_type == workerAddressType) {
        oThis.workerAddrObjs.push(addressObj);
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Transfer ST Prime if needed
   *
   * @returns {promise<result>}
   * @private
   */
  _transferStPrimeIfNeeded: async function(){

    const oThis = this;

    const reservePassphraseD = 'no_password';

    for(var i=0; i<oThis.workerAddrObjs.length; i++) {

      var workerAddrObj = oThis.workerAddrObjs[i];

      if(await oThis._isTransferRequired(workerAddrObj.ethereum_address)) {

        //transfer to worker
        const transferBalanceResponse = await oThis._transferBalance(oThis.reserveAddrObj.ethereum_address, reservePassphraseD,
            workerAddrObj.ethereum_address, oThis._TO_TRANSFER);

        if(transferBalanceResponse.isSuccess()) {

          const dbObjects = await new ClientWorkerManagedAddressIdsKlass().select('id, properties')
              .where(['client_id=? AND managed_address_id=?', oThis.clientId, workerAddrObj.id]).fire()
          , dbObject = dbObjects[0];

          await new ClientWorkerManagedAddressIdsKlass()
            .update({properties: new ClientWorkerManagedAddressIdsKlass().setBit(clientWorkerManagedAddressConst.hasStPrimeBalanceProperty, dbObject.properties)})
            .where({id: dbObject.id}).fire();

          new ClientActiveWorkerUuidCacheKlass({client_id: oThis.clientId}).clear();

        }

      }

    }

    if(await oThis._isTransferRequired(oThis.airdropHolderAddrObj.ethereum_address)){
      //transfer to airdrop holder
      await oThis._transferBalance(oThis.reserveAddrObj.ethereum_address, reservePassphraseD,
          oThis.airdropHolderAddrObj.ethereum_address, oThis._TO_TRANSFER);
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * Check ST Prime Balance of Reserve Address and notify if less
   *
   * @param {string} ethereumAddress - Address to check balance for
   *
   * @returns {promise<result>}
   * @private
   */
  _checkBalanceOfReserveAddress: async function () {
    const oThis = this
      , ethereumAddress = oThis.reserveAddrObj.ethereum_address
      , minReserveAddrBalanceToProceedInWei = oThis._MIN_AVAILABLE_BALANCE_RESERVE
      , fetchBalanceObj = new openStPlatform.services.balance.simpleTokenPrime({address: ethereumAddress})
      , balanceResponse = await fetchBalanceObj.perform()
    ;

    if (balanceResponse.isFailure()) return Promise.resolve(balanceResponse);

    const balanceBigNumberInWei = basicHelper.convertToBigNumber(balanceResponse.data.balance);

    if (balanceBigNumberInWei.lessThan(minReserveAddrBalanceToProceedInWei)) {
      return Promise.resolve(responseHelper.error('s_a_fca_1', 'Not enough balance', null, [],
        {sendErrorEmail: false}));
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
        , transferParams = {
          sender_address: reserveAddress,
          sender_passphrase: reservePassphrase,
          recipient_address: recipientAddress,
          amount_in_wei: transferAmountInWei,
          options: {returnType: 'txReceipt', tag: ''}
        }
    ;

    const transferSTPrimeBalanceObj = new openStPlatform.services.transaction.transfer.simpleTokenPrime(transferParams);

    const transferResponse = await transferSTPrimeBalanceObj.perform();

    if (transferResponse.isFailure()) {
      logger.notify('e_fa_e_teb_1', "Error in transfer of " + transferAmountInWei + "Wei Eth to Address - " + recipientAddress, transferResponse);
      return Promise.resolve(transferResponse);
    }

    return Promise.resolve(transferResponse);
  }

};

module.exports = FundClientAddressKlass;