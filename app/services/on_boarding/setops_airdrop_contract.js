"use strict";

/**
 * Set ops address in the airdrop contract.
 *
 * @module app/services/on_boarding/setops_airdrop_contract
 *
 */

const OpenStPaymentsKlass = require('@openstfoundation/openst-payments');

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , clientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
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

};

SetopsAirdropContractClass.prototype = {

  perform: async function () {
    var oThis = this
      , r;

    r = await oThis.validateAndSanitize();
    if (r.isFailure()) return Promise.resolve(r);

    return await oThis.setops();

  },

  validateAndSanitize: async function () {

    var oThis = this;

    if (!oThis.tokenSymbol || !oThis.clientId) {
      return Promise.resolve(responseHelper.error('ob_spo_2', 'Mandatory params missing.'));
    }

    const clientBrandedTokenObj = new clientBrandedTokenKlass();
    const clientBrandedToken = await clientBrandedTokenObj.getBySymbol(oThis.tokenSymbol);
    const brandedToken = clientBrandedToken[0];

    if (brandedToken.client_id != oThis.clientId) {
      return Promise.resolve(responseHelper.error('ob_spo_1', 'Unauthorised request'));
    }

    oThis.airDropContractAddress = brandedToken.airdrop_contract_addr;

    if (!oThis.airDropContractAddress) {
      return Promise.resolve(responseHelper.error('ob_spo_3', 'Airdrop contract address is mandatory.'));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  setops: async function () {

    var oThis = this;

    const opsManaged = new OpenStPaymentsKlass.opsManaged(oThis.airDropContractAddress, oThis.gasPrice, oThis.chainId);

    var r = await opsManaged.setOpsAddress(
      oThis.utilityDeployerAddress,
      oThis.utilityDeployerPassphrase,
      oThis.utilityOpsAddress,
      {returnType: "txHash"}
    );

    if(r.isFailure()){
      return Promise.resolve(responseHelper.error('ob_dac_2', 'Setops airdrop contract failed.'));
    }

    return Promise.resolve(r);
  }

};

module.exports = SetopsAirdropContractClass;