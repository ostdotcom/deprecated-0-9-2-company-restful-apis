"use strict";

const OpenStPaymentsKlass = require('@openstfoundation/openst-payments')
;

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , clientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , utils = require(rootPrefix + '/lib/util')
;

const SetWorkerKlass = function (params) {

  var oThis = this;
  oThis.tokenSymbol = params['token_symbol'];
  oThis.clientId = params['client_id'];

  oThis.senderAddress = chainIntConstants.UTILITY_OPS_ADDR;
  oThis.senderPassphrase = chainIntConstants.UTILITY_OPS_PASSPHRASE;
  oThis.chainId = chainIntConstants.UTILITY_CHAIN_ID;
  oThis.gasPrice = chainIntConstants.UTILITY_GAS_PRICE;

  oThis.priceOracleContractAddress = chainIntConstants.UTILITY_PRICE_ORACLES.OST.USD;
  oThis.airDropContractAddress = '';

};

SetWorkerKlass.prototype = {

  perform: async function () {

    var oThis = this
      , r = null;

    r = await oThis.validateAndSanitize();
    if (r.isFailure()) return Promise.resolve(r);

    const airdrop = new OpenStPaymentsKlass.airdrop(oThis.airDropContractAddress, oThis.chainId);

    r = await airdrop.setPriceOracle(
      oThis.senderAddress,
      oThis.senderPassphrase,
      'USD',
      oThis.priceOracleContractAddress,
      oThis.gasPrice,
      {returnType: "txHash"}
    );

    return Promise.resolve(r);
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

  }

};

module.exports = SetWorkerKlass;