"use strict";

/**
 *
 * Start airdrop token transfer from reserve address to budget holder address.<br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/token_transfer
 *
 */

const openStPayments = require('@openstfoundation/openst-payments')
  , AirdropManagerTransferKlass = openStPayments.services.airdropManager.transfer
;

const rootPrefix = '../../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , ClientAirdropDetailModel = require(rootPrefix + '/app/models/client_airdrop_details')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , FundClientAddressKlass = require(rootPrefix + '/app/services/address/fund_client_address')
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
    ;

    // fetch branded token details
    const clientBrandedTokenSqlResponse = await new ClientBrandedTokenModel().getById(oThis.clientBrandedTokenId);
    oThis.clientBrandedTokenObj = clientBrandedTokenSqlResponse[0];

    // decrypt reserve passphrase
    const managedAddressSqlResponse = await new ManagedAddressModel().getByIds([oThis.clientBrandedTokenObj.reserve_managed_address_id])
      , managedAddressObj = managedAddressSqlResponse[0]
      , managedAddressPassphrase = 'no_password'
    ;

    // Get total tokens to be transfered from reserve to budget holder
    const totalAmountSqlResponse = await new ClientAirdropDetailModel().getTotalTransferAmount(oThis.clientAirdropId)
      , totalAmountInWei = basicHelper.formatWeiToString(totalAmountSqlResponse[0].totalAmountInWei)
    ;

    const refillResponse = await oThis._checkAndRefillSTPrimeBalance();

    if (refillResponse.isFailure()) {
      return Promise.resolve(refillResponse);
    }

    // Initiate transfer

    const transferObject = new AirdropManagerTransferKlass({
      sender_address: managedAddressObj.ethereum_address,
      sender_passphrase: managedAddressPassphrase,
      airdrop_contract_address: oThis.clientBrandedTokenObj.airdrop_contract_addr,
      amount: totalAmountInWei,
      gas_price: chainInteractionConstants.UTILITY_GAS_PRICE,
      chain_id: chainInteractionConstants.UTILITY_CHAIN_ID,
      options: {tag: '', returnType: 'txReceipt'}
    });

    const response = await transferObject.perform();

    if (response.isFailure()) {
      logger.notify(
        'am_dt_tt_p_2',
        'Error in tokenTransfer',
        response,
        {clientAirdropId: oThis.clientAirdropId}
      );
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
      ,  fundClientAddressObj = new FundClientAddressKlass({client_id: oThis.clientBrandedTokenObj.client_id})
      ,  fundResponse = await fundClientAddressObj.perform()
    ;

    if (fundResponse.isFailure()) {
      logger.notify(
        'am_dt_tt_carstpb_1',
        'Error in checkAndRefillSTPrimeBalance',
        fundResponse,
        {clientAirdropId: oThis.clientAirdropId}
      );
    }

    return Promise.resolve(fundResponse);
  }

};

module.exports = tokenTransferKlass;