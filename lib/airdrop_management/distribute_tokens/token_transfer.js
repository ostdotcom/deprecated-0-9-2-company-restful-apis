'use strict';

/**
 *
 * Start airdrop token transfer from reserve address to budget holder address.<br><br>
 *
 * @module lib/airdrop_management/distribute_tokens/token_transfer
 *
 */

const rootPrefix = '../../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  ClientAirdropDetailModel = require(rootPrefix + '/app/models/client_airdrop_details'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/app/services/address/fund_client_address');
require(rootPrefix + '/lib/providers/payments');
require(rootPrefix + '/lib/cache_management/client_branded_token');

/**
 * Start airdrop token transfer from reserve address to budget holder address constructor
 *
 * @param {object} params -
 * @param {number} params.client_airdrop_id - client airdrop id for which airdrop has to be done
 * @param {number} params.client_branded_token_id - client branded token id
 *
 * @constructor
 */
const tokenTransferKlass = function(params) {
  const oThis = this;
  oThis.clientId = params.client_id;
  oThis.clientBrandedTokenId = params.client_branded_token_id;
  oThis.clientAirdropId = params.client_airdrop_id;

  oThis.clientBrandedTokenObj = null;
};

tokenTransferKlass.prototype = {
  perform: async function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    const clientBrandedTokenCacheKlass = oThis.ic().getClientBrandedTokenCache(),
      clientBrandedTokenCacheObj = new clientBrandedTokenCacheKlass({ clientId: oThis.clientId });

    // fetch branded token details
    const clientBTCacheResponse = await clientBrandedTokenCacheObj.fetch();

    if (clientBTCacheResponse.isFailure()) return Promise.reject(clientBTCacheResponse);

    oThis.clientBrandedTokenObj = clientBTCacheResponse.data;

    // decrypt reserve passphrase
    const managedAddressSqlResponse = await new ManagedAddressModel().getByIds([
        oThis.clientBrandedTokenObj.reserve_managed_address_id
      ]),
      managedAddressObj = managedAddressSqlResponse[0],
      managedAddressPassphrase = 'no_password';

    // Get total tokens to be transfered from reserve to budget holder
    const totalAmountSqlResponse = await new ClientAirdropDetailModel().getTotalTransferAmount(oThis.clientAirdropId),
      totalAmountInWei = basicHelper.formatWeiToString(totalAmountSqlResponse[0].totalAmountInWei);

    const refillResponse = await oThis._checkAndRefillSTPrimeBalance();

    if (refillResponse.isFailure()) {
      return Promise.resolve(refillResponse);
    }

    // Initiate transfer

    const paymentsProvider = oThis.ic().getPaymentsProvider(),
      openSTPayments = paymentsProvider.getInstance();

    const transferObject = new openSTPayments.services.airdropManager.transfer({
      sender_address: managedAddressObj.ethereum_address,
      sender_passphrase: managedAddressPassphrase,
      airdrop_contract_address: oThis.clientBrandedTokenObj.airdrop_contract_addr,
      amount: totalAmountInWei,
      gas_price: configStrategy.OST_UTILITY_GAS_PRICE,
      chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
      options: { tag: '', returnType: 'txReceipt' }
    });

    const response = await transferObject.perform();

    if (response.isFailure()) {
      logger.notify('am_dt_tt_p_2', 'Error in tokenTransfer', response, { clientAirdropId: oThis.clientAirdropId });
    }

    return Promise.resolve(response);
  },

  /**
   * Check ST Prime Balance of Budget Holder and worker Address and refill if nedded from reserve address
   *
   *
   * @return {Promise<result>}
   *
   */
  _checkAndRefillSTPrimeBalance: async function() {
    const oThis = this,
      FundClientAddressKlass = oThis.ic().getFundClientAddressClass(),
      fundClientAddressObj = new FundClientAddressKlass({ client_id: oThis.clientId }),
      fundResponse = await fundClientAddressObj.perform();

    if (fundResponse.isFailure()) {
      logger.notify('am_dt_tt_carstpb_1', 'Error in checkAndRefillSTPrimeBalance', fundResponse, {
        clientAirdropId: oThis.clientAirdropId
      });
    }

    return Promise.resolve(fundResponse);
  }
};

InstanceComposer.registerShadowableClass(tokenTransferKlass, 'getTokenTransferClass');

module.exports = tokenTransferKlass;
