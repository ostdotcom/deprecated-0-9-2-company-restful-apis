"use strict";

const openStPayments = require('@openstfoundation/openst-payments')
;

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , clientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , ClientWorkerManagedAddressIdsKlass = require(rootPrefix + '/app/models/client_worker_managed_address_id')
  , clientWorkerManagedAddressIds = new ClientWorkerManagedAddressIdsKlass()
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

const SetWorkerKlass = function (params) {

  var oThis = this;
  oThis.tokenSymbol = params['token_symbol'];
  oThis.clientId = params['client_id'];
  oThis.waitForReceipt = params['wait_for_recipt'] || false;

  oThis.workerContractAddress = chainIntConstants.UTILITY_WORKERS_CONTRACT_ADDRESS;
  oThis.senderAddress = chainIntConstants.UTILITY_OPS_ADDR;
  oThis.senderPassphrase = chainIntConstants.UTILITY_OPS_PASSPHRASE;
  oThis.chainId = chainIntConstants.UTILITY_CHAIN_ID;
  oThis.gasPrice = chainIntConstants.UTILITY_GAS_PRICE;

  oThis.deactivationHeight = basicHelper.convertToBigNumber(10).toPower(18).toString(10);

  oThis.workerAddressesIdMap = {};

};

SetWorkerKlass.prototype = {

  perform: async function () {

    var oThis = this
      , r = null;

    r = await oThis.validateAndSanitize();
    if (r.isFailure()) return Promise.resolve(r);

    const workers = new openStPayments.workers(oThis.workerContractAddress, oThis.chainId);

    var workerAddrs = Object.keys(oThis.workerAddressesIdMap)
        , promiseResolvers = []
        , promiseResponses = []
        , formattedPromiseResponses = {}
        , promise = null;

    var returnType = (oThis.waitForReceipt ? 'txReceipt' : 'txHash');
    for(var i=0; i<workerAddrs.length; i++) {
      promise = workers.setWorker(
          oThis.senderAddress,
          oThis.senderPassphrase,
          workerAddrs[i],
          oThis.deactivationHeight,
          oThis.gasPrice,
          {returnType: returnType, tag: ""}
      );
      promiseResolvers.push(promise);
    }

    promiseResponses = await Promise.all(promiseResolvers);

    for(var i=0; i<promiseResolvers.length; i++) {
      var r = promiseResponses[i];
      if (r.isFailure()) {
        logger.notify('s_ob_sw_1', 'Set Worker Failed', r.toHash);
        return Promise.resolve(r);
      } else {
        r.data['status'] = transactionLogConst.processingStatus;
        formattedPromiseResponses[oThis.workerAddressesIdMap[workerAddrs[i]]] = r.data;
      }
    }

    return Promise.resolve(responseHelper.successWithData(formattedPromiseResponses));

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

    const existingWorkerManagedAddresses = await clientWorkerManagedAddressIds.getInActiveByClientId(oThis.clientId);
    var managedAddressIdClientWorkerAddrIdMap = {};
    for(var i=0; i<existingWorkerManagedAddresses.length; i++) {
      managedAddressIdClientWorkerAddrIdMap[parseInt(existingWorkerManagedAddresses[i].managed_address_id)] = existingWorkerManagedAddresses[i].id;
    }
    const managedAddressInstance = new ManagedAddressKlass()
      , managedAddresses = await managedAddressInstance.getByIds(Object.keys(managedAddressIdClientWorkerAddrIdMap));

    for(var i=0; i<managedAddresses.length; i++) {
      oThis.workerAddressesIdMap[managedAddresses[i].ethereum_address] = managedAddressIdClientWorkerAddrIdMap[managedAddresses[i].id];
    }

    if (Object.keys(oThis.workerAddressesIdMap).length == 0) {
      return Promise.resolve(responseHelper.error('ob_sw_3', 'Worker address is mandatory.'));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = SetWorkerKlass;