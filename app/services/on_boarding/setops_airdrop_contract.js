"use strict";

/**
 * Set ops address in the airdrop contract.
 *
 * @module app/services/on_boarding/setops_airdrop_contract
 *
 */

const openStPayments = require('@openstfoundation/openst-payments');

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , clinetBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , ApproveContractKlass = require(rootPrefix + '/lib/transactions/approve_contract')
;

const SetopsAirdropContractClass = function (params) {

  var oThis = this;

  oThis.clientId = params.client_id;
  oThis.tokenSymbol = params.token_symbol;

  oThis.utilityDeployerAddress = chainIntConstants.UTILITY_DEPLOYER_ADDR;
  oThis.utilityDeployerPassphrase = chainIntConstants.UTILITY_DEPLOYER_PASSPHRASE;
  oThis.utilityOpsAddress = chainIntConstants.UTILITY_OPS_ADDR;
  oThis.chainId = chainIntConstants.UTILITY_CHAIN_ID;
  oThis.gasPrice = chainIntConstants.UTILITY_GAS_PRICE;

  oThis.airDropContractAddress = '';
  oThis.btContractAddress = '';

};

SetopsAirdropContractClass.prototype = {

  perform: async function () {
    var oThis = this
      , r;

    r = await oThis.validateAndSanitize();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.registerAirdrop();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.setops();
    if (r.isFailure()) return Promise.resolve(r);

    return await oThis.approveReserveForAirdropContract();

  },

  validateAndSanitize: async function () {

    var oThis = this;

    if (!oThis.tokenSymbol || !oThis.clientId) {
      return Promise.resolve(responseHelper.error('ob_spo_2', 'Mandatory params missing.'));
    }

    const clientBrandedTokenObj = new clinetBrandedTokenCacheKlass({tokenSymbol: oThis.tokenSymbol});
    const clientBrandedToken = await clientBrandedTokenObj.fetch();
    if(clientBrandedToken.isFailure()){
      return Promise.resolve(responseHelper.error('ob_spo_3', 'Token not found.'));
    }

    const brandedToken = clientBrandedToken.data;

    if (brandedToken.client_id != oThis.clientId) {
      return Promise.resolve(responseHelper.error('ob_spo_1', 'Unauthorised request'));
    }

    oThis.airDropContractAddress = brandedToken.airdrop_contract_address;
    oThis.btContractAddress = brandedToken.token_erc20_address;
    oThis.reserveUuid = brandedToken.reserve_address_uuid;

    if (!oThis.airDropContractAddress) {
      return Promise.resolve(responseHelper.error('ob_spo_3', 'Airdrop contract address is mandatory.'));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  setops: async function () {

    var oThis = this;

    const opsManaged = new openStPayments.opsManaged(oThis.airDropContractAddress, oThis.gasPrice, oThis.chainId);

    var r = await opsManaged.setOpsAddress(
      oThis.utilityDeployerAddress,
      oThis.utilityDeployerPassphrase,
      oThis.utilityOpsAddress,
      {returnType: "txHash", tag: ''}
    );

    if(r.isFailure()){
      return Promise.resolve(responseHelper.error('ob_dac_2', 'Setops airdrop contract failed.'));
    }

    return Promise.resolve(r);
  },

  registerAirdrop: async function () {
    var oThis = this;
    return openStPayments.airdropManager.registerAirdrop(oThis.airDropContractAddress, oThis.chainId);
  },

  /**
   * Approve Reserve of client for Airdrop contract
   *
   * @return {Promise<void>}
   */
  approveReserveForAirdropContract: async function(){
    const oThis = this;
    var inputParams = {approverUuid: oThis.reserveUuid, token_erc20_address: oThis.btContractAddress,
      approvee_address: oThis.airDropContractAddress, return_type: 'txReceipt'};
    return new ApproveContractKlass(inputParams).perform();
  }

};

module.exports = SetopsAirdropContractClass;