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
;

const rootPrefix = '../../..'
  , ClientAirdropDetailsKlass = require(rootPrefix + '/app/models/client_airdrop_details')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , fundClientAddressKlass = require(rootPrefix + '/app/services/address/fund_client_address')
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
      , managedAddressPassphrase = 'no_password'
    ;

    // Get total tokens to be transfered from reserve to budget holder
    const totalAmountSqlResponse = await clientAirdropDetails.getTotalTransferAmount(oThis.clientAirdropId)
      , totalAmountInWei = basicHelper.formatWeiToString(totalAmountSqlResponse[0].totalAmountInWei)
    ;

    const refillResponse = await oThis._checkAndRefillSTPrimeBalance();

    if (refillResponse.isFailure()) {
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
      {returnType: "txReceipt", tag: ""}
    );

    if (response.isFailure()) {
      logger.notify('am_dt_tt_p_2', 'Error in tokenTransfer', response, {clientAirdropId: oThis.clientAirdropId});
    }

    return Promise.resolve(response);
  },

  /**
   * Check ST Prime Balance of Budget Holder and worker Address and refill if nedded from reserve address
   *
   *
   * @return {promise<result>}
   *
   */
  _checkAndRefillSTPrimeBalance: async function () {

    const oThis = this
      ,  fundClientAddressObj = new fundClientAddressKlass({client_id: oThis.clientBrandedTokenObj.client_id})
      ,  fundResponse = await fundClientAddressObj.perform()
    ;

    if (fundResponse.isFailure()) {
      logger.notify('am_dt_tt_carstpb_1', 'Error in checkAndRefillSTPrimeBalance', fundResponse, {clientAirdropId: oThis.clientAirdropId});
    }

    return Promise.resolve(fundResponse);
  }

};

module.exports = tokenTransferKlass;