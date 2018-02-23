"use strict";

const OpenStPaymentsKlass = require('@openstfoundation/openst-payments')
;

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , clientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

const SetWorkerKlass = function (params) {

  var oThis = this;
  oThis.tokenSymbol = params['token_symbol'];
  oThis.clientId = params['client_id'];

  oThis.workerContractAddress = chainIntConstants.UTILITY_WORKERS_CONTRACT_ADDRESS;
  oThis.senderAddress = chainIntConstants.UTILITY_OPS_ADDR;
  oThis.senderPassphrase = chainIntConstants.UTILITY_OPS_PASSPHRASE;
  oThis.chainId = chainIntConstants.UTILITY_CHAIN_ID;
  oThis.gasPrice = chainIntConstants.UTILITY_GAS_PRICE;

  oThis.deactivationHeight = basicHelper.convertToBigNumber(10).toPower(18).toString(10);

  oThis.workerAddress = '';

};

SetWorkerKlass.prototype = {

  perform: async function () {

    var oThis = this
      , r = null;

    r = await oThis.validateAndSanitize();
    if (r.isFailure()) return Promise.resolve(r);

    const workers = new OpenStPaymentsKlass.workers(oThis.workerContractAddress, oThis.chainId);

    r = await workers.setWorker(
      oThis.senderAddress,
      oThis.senderPassphrase,
      oThis.workerAddress,
      oThis.deactivationHeight,
      oThis.gasPrice,
      {returnType: "txHash"}
    );

    return Promise.resolve(r);
  },

  validateAndSanitize: async function () {

    var oThis = this;

    if (!oThis.tokenSymbol || !oThis.clientId) {
      return Promise.resolve(responseHelper.error('ob_sw_2', 'Mandatory params missing.'));
    }

    if (!oThis.workerContractAddress) {
      return Promise.resolve(responseHelper.error('ob_sw_2', 'Mandatory to have Workers contract deployed.'));
    }

    const clientBrandedTokenObj = new clientBrandedTokenKlass();
    const clientBrandedToken = await clientBrandedTokenObj.getBySymbol(oThis.tokenSymbol);
    const brandedToken = clientBrandedToken[0];

    if (brandedToken.client_id != oThis.clientId) {
      return Promise.resolve(responseHelper.error('ob_sw_1', 'Unauthorised request'));
    }

    const workerManagedAddressId = brandedToken.worker_managed_address_id
      , managedAddressInstance = new ManagedAddressKlass()
      , managedAddresses = await managedAddressInstance.getByIds([workerManagedAddressId]);

    oThis.workerAddress = managedAddresses[0].ethereum_address;

    if (!oThis.workerAddress) {
      return Promise.resolve(responseHelper.error('ob_sw_3', 'Worker address is mandatory.'));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = SetWorkerKlass;