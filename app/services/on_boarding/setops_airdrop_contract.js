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
  , clientBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
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

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("ob_sac_6", "Unhandled result", null, {}, {});
        }
      })
  },

  asyncPerform: async function () {
    var oThis = this
      , r;

    r = await oThis.validateAndSanitize();
    if (r.isFailure()) return Promise.resolve(r);

    r = await oThis.registerAirdrop();
    if (r.isFailure()) return Promise.resolve(r);

    return await oThis.setops();

  },

  validateAndSanitize: async function () {

    var oThis = this;

    if (!oThis.tokenSymbol || !oThis.clientId) {
      return Promise.resolve(responseHelper.error('ob_sac_2', 'Mandatory params missing.'));
    }

    const clientBrandedTokenObj = new clientBrandedTokenCacheKlass({tokenSymbol: oThis.tokenSymbol});
    const clientBrandedToken = await clientBrandedTokenObj.fetch();
    if(clientBrandedToken.isFailure()){
      return Promise.resolve(responseHelper.error('ob_sac_3', 'Token not found.'));
    }

    const brandedToken = clientBrandedToken.data;

    if (brandedToken.client_id != oThis.clientId) {
      return Promise.resolve(responseHelper.error('ob_sac_1', 'Unauthorised request'));
    }

    oThis.airDropContractAddress = brandedToken.airdrop_contract_address;
    oThis.btContractAddress = brandedToken.token_erc20_address;
    oThis.reserveUuid = brandedToken.reserve_address_uuid;

    if (!oThis.airDropContractAddress) {
      return Promise.resolve(responseHelper.error('ob_sac_4', 'Airdrop contract address is mandatory.'));
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
      return Promise.resolve(responseHelper.error('ob_sac_5', 'Setops airdrop contract failed.'));
    }

    return Promise.resolve(r);
  },

  registerAirdrop: async function () {
    var oThis = this;
    return openStPayments.airdropManager.registerAirdrop(oThis.airDropContractAddress, oThis.chainId);
  }

};

module.exports = SetopsAirdropContractClass;