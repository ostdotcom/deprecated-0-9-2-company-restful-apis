"use strict";

/**
 * Deploy airdrop contract
 *  - deploy airdrop contract
 *  - setops(utility ops address) to airdrop contract
 *  - register airdrop contract address
 *
 * @module lib/on_boarding/deploy_airdrop
 *
 */

const openStPayments = require('@openstfoundation/openst-payments')
  , openStPaymentsDeployer = new openStPayments.deployer()
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , utils = require(rootPrefix + '/lib/util')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;


/**
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id - client id
 * @param {number} params.branded_token_id - id of saas branded token table.
 *
 */
const SetupAirdropContractClass = function (params) {

  var oThis = this;

  oThis.clientId = params.client_id;
  oThis.brandedTokenId = params.branded_token_id;

  oThis.contractName = 'airdrop';
  oThis.workerContractAddress = chainIntConstants.UTILITY_WORKERS_CONTRACT_ADDRESS;
  oThis.gasPrice = chainIntConstants.UTILITY_GAS_PRICE;
  oThis.utilityDeployerAddress = chainIntConstants.UTILITY_DEPLOYER_ADDR;
  oThis.utilityDeployerPassphrase = chainIntConstants.UTILITY_DEPLOYER_PASSPHRASE;
  oThis.utilityOpsAddress = chainIntConstants.UTILITY_OPS_ADDR;
  oThis.chainId = chainIntConstants.UTILITY_CHAIN_ID;

  oThis.brandedTokenAddress = null;
  oThis.airdropBudgetHolderAddr = null;
  oThis.airdropContractAddress = null;
  oThis.reserveUuid = null;

};

SetupAirdropContractClass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function () {
    var oThis = this
      , r = null
    ;

    return oThis.asyncPerform().catch(function (error) {
      logger.error('Setup Airdrop contract failed with error - ', error);
      return Promise.resolve(responseHelper.error("s_ob_sac_1", "Inside catch block", null, {},
        {sendErrorEmail: false}));
    });

  },

  /**
   * Async perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function () {
    var oThis = this
      , r = null
    ;

    r = await oThis.getAddresses();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.deployAirdrop();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.registerAirdrop();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.setopsAirdrop();
    if (r.isFailure()) return Promise.resolve(r);

    return Promise.resolve(r);
  },

  /**
   * validate and fetch required data from db.
   *
   * sets brandedTokenAddress, airdropContractAddress, reserveUuid, airdropBudgetHolderAddr
   *
   * @return {promise<result>}
   */
  getAddresses: async function () {

    var oThis = this;

    if (!oThis.brandedTokenId || !oThis.clientId) {
      return Promise.reject(responseHelper.error('l_am_s_1', 'Mandatory params missing.'));
    }

    if (!oThis.workerContractAddress) {
      return Promise.reject(responseHelper.error('l_am_s_1', 'Mandatory to have Workers contract deployed.'));
    }

    const clientBrandedToken = await new ClientBrandedTokenModel().select('*').where(['id=?', oThis.brandedTokenId]);

    const brandedToken = clientBrandedToken[0];

    if (brandedToken.client_id != oThis.clientId) {
      return Promise.reject(responseHelper.error('l_am_s_1', 'Unauthorised request'));
    }
    oThis.brandedTokenAddress = brandedToken.token_erc20_address;

    if (!oThis.brandedTokenAddress) {
      return Promise.reject(responseHelper.error('l_am_s_1', 'Mandatory to have Branded token contract deployed.'));
    }
    oThis.airdropContractAddress = brandedToken.airdrop_contract_address;
    oThis.reserveUuid = brandedToken.reserve_address_uuid;

    if (!oThis.airdropContractAddress) {
      return Promise.resolve(responseHelper.error('l_am_s_1', 'Airdrop contract address is mandatory.'));
    }

    const airdropHolderManagedAddressId = brandedToken.airdrop_holder_managed_address_id
      , managedAddressInstance = new ManagedAddressKlass()
      , managedAddresses = await managedAddressInstance.getByIds([airdropHolderManagedAddressId]);

    oThis.airdropBudgetHolderAddr = managedAddresses[0].ethereum_address;

    if (!oThis.airdropBudgetHolderAddr) {
      return Promise.reject(responseHelper.error('l_am_s_1', 'Airdrop budget holder address is mandatory.'));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * deploy airdrop contract.
   *
   * @return {promise<result>}
   */
  deployAirdrop: async function () {

    const oThis = this;

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
      {returnType: "txReceipt", tag: ""}
    );

    if (r.isFailure()) {
      return Promise.reject(responseHelper.error('l_am_s_1', 'Airdrop contract deployment failed.'));
    } else {
      // TODO: update critical logs table here.
    }

    return Promise.resolve(r);
  },

  registerAirdrop: async function () {
    var oThis = this;
    return openStPayments.airdropManager.registerAirdrop(oThis.airdropContractAddress, oThis.chainId);
  },

  /**
   * setops(utility_ops_address) to airdrop contract.
   *
   * @return {promise<result>}
   */
  setopsAirdrop: async function () {

    const oThis = this;

    const opsManaged = new openStPayments.opsManaged(oThis.airdropContractAddress, oThis.gasPrice, oThis.chainId);

    var r = await opsManaged.setOpsAddress(
      oThis.utilityDeployerAddress,
      oThis.utilityDeployerPassphrase,
      oThis.utilityOpsAddress,
      {returnType: "txReceipt", tag: ''}
    );

    if(r.isFailure()){
      return Promise.resolve(responseHelper.error('l_am_s_1', 'Setops airdrop contract failed.'));
    } else {
      // TODO: update critical logs table here.
    }

    return Promise.resolve(r);

  }

};

module.exports = SetupAirdropContractClass;