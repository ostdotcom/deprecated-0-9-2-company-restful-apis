"use strict";

const openStPayments = require('@openstfoundation/openst-payments')
  , openStPaymentsDeployer = new openStPayments.deployer()
;

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , clientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , utils = require(rootPrefix + '/lib/util')
;

const DeployAirdropContractClass = function (params) {

  var oThis = this;

  oThis.clientId = params.client_id;
  oThis.tokenSymbol = params.token_symbol;

  oThis.contractName = 'airdrop';
  oThis.workerContractAddress = chainIntConstants.UTILITY_WORKERS_CONTRACT_ADDRESS;
  oThis.gasPrice = chainIntConstants.UTILITY_GAS_PRICE;

  oThis.brandedTokenAddress = null;
  oThis.airdropBudgetHolderAddr = null;

};

DeployAirdropContractClass.prototype = {

  perform: async function () {
    var oThis = this
      , r = null
    ;

    r = await oThis.getAddresses();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.deploy_airdrop();

    return Promise.resolve(r);

  },

  getAddresses: async function () {

    var oThis = this;

    if (!oThis.workerContractAddress) {
      return Promise.resolve(responseHelper.error('ob_dac_2', 'Mandatory to have Workers contract deployed.'));
    }

    const clientBrandedTokenObj = new clientBrandedTokenKlass();
    const clientBrandedToken = await clientBrandedTokenObj.getBySymbol(oThis.tokenSymbol);

    const brandedToken = clientBrandedToken[0];

    if (brandedToken.client_id != oThis.clientId) {
      return Promise.resolve(responseHelper.error('ob_dac_1', 'Unauthorised request'));
    }
    oThis.brandedTokenAddress = brandedToken.token_erc20_address;

    if (!oThis.brandedTokenAddress) {
      return Promise.resolve(responseHelper.error('ob_dac_2', 'Mandatory to have Branded token contract deployed.'));
    }

    const airdropHolderManagedAddressId = brandedToken.airdrop_holder_managed_address_id
      , managedAddressInstance = new ManagedAddressKlass()
      , managedAddresses = await managedAddressInstance.getByIds([airdropHolderManagedAddressId]);

    oThis.airdropBudgetHolderAddr = managedAddresses[0].ethereum_address;

    if (!oThis.airdropBudgetHolderAddr) {
      return Promise.resolve(responseHelper.error('ob_dac_2', 'Airdrop budget holder address is mandatory.'));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  deploy_airdrop: async function () {

    var oThis = this;

    const constructorArgs = [
      oThis.brandedTokenAddress,
      utils.asciiToHex('OST'),
      oThis.workerContractAddress,
      oThis.airdropBudgetHolderAddr
    ];

    var r = await openStPaymentsDeployer.deploy(
      oThis.contractName,
      constructorArgs,
      oThis.gasPrice,
      {returnType: "txHash"}
    );

    if (r.isFailure()) {
      return Promise.resolve(responseHelper.error('ob_dac_2', 'Airdrop contract deployment failed.'));
    }

    return Promise.resolve(r);
  }

};

module.exports = DeployAirdropContractClass;