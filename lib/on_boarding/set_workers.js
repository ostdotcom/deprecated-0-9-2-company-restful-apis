"use strict";

/**
 * set multiple worker addresses to workers contract.
 *
 * @module lib/on_boarding/set_workers
 *
 */

const openStPayments = require('@openstfoundation/openst-payments')
;

const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , ClientWorkerManagedAddressIdsModel = require(rootPrefix + '/app/models/client_worker_managed_address_id')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , OnBoardingRouter = require(rootPrefix + '/lib/on_boarding/router')
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
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
const SetWorkerKlass = function (params) {

  var oThis = this;
  oThis.brandedTokenId = params.branded_token_id;
  oThis.clientId = params['client_id'];

  oThis.workerContractAddress = chainIntConstants.UTILITY_WORKERS_CONTRACT_ADDRESS;
  oThis.senderAddress = chainIntConstants.UTILITY_OPS_ADDR;
  oThis.senderPassphrase = chainIntConstants.UTILITY_OPS_PASSPHRASE;
  oThis.chainId = chainIntConstants.UTILITY_CHAIN_ID;
  oThis.gasPrice = chainIntConstants.UTILITY_GAS_PRICE;

  oThis.deactivationHeight = basicHelper.convertToBigNumber(10).toPower(18).toString(10);

  oThis.workerAddressesIdMap = {};

};

SetWorkerKlass.prototype = {

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
      return Promise.resolve(responseHelper.error("l_ob_sw_1", "Inside catch block", null, {},
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
      , r = null;

    r = await oThis.validateAndSanitize();
    if (r.isFailure()) return Promise.resolve(r);

    const workers = new openStPayments.workers(oThis.workerContractAddress, oThis.chainId);

    var workerAddrs = Object.keys(oThis.workerAddressesIdMap)
      , promiseResolvers = []
      , promiseResponses = []
      , formattedPromiseResponses = {}
      , successWorkerAddrIds = []
      , promise = null;

    for(var i=0; i<workerAddrs.length; i++) {
      promise = workers.setWorker(
          oThis.senderAddress,
          oThis.senderPassphrase,
          workerAddrs[i],
          oThis.deactivationHeight,
          oThis.gasPrice,
          {returnType: 'txReceipt', tag: ""}
      );
      promiseResolvers.push(promise);
    }

    promiseResponses = await Promise.all(promiseResolvers);

    for(var i=0; i<promiseResolvers.length; i++) {
      r = promiseResponses[i];
      if (r.isFailure()) {
        logger.notify('l_ob_sw_2', 'Set Worker Failed', r.toHash);
      } else {
        r.data['status'] = transactionLogConst.processingStatus;
        formattedPromiseResponses[oThis.workerAddressesIdMap[workerAddrs[i]]] = r.data;
        successWorkerAddrIds.push(oThis.workerAddressesIdMap[workerAddrs[i]]);
      }
    }

    if(successWorkerAddrIds.length > 0) await new ClientWorkerManagedAddressIdsModel().markStatusActive(successWorkerAddrIds);

    // TODO: update critical logs table here.

    return Promise.resolve(responseHelper.successWithData(formattedPromiseResponses));

  },

  /**
   * validate and sanitize.
   *
   * sets workerAddressesIdMap
   *
   * @return {Promise.<result>}
   */
  validateAndSanitize: async function () {

    var oThis = this;

    if (!oThis.brandedTokenId || !oThis.clientId) {
      return Promise.resolve(responseHelper.error('l_ob_sw_3', 'Mandatory params missing.'));
    }

    if (!oThis.workerContractAddress) {
      return Promise.resolve(responseHelper.error('l_ob_sw_4', 'Mandatory to have Workers contract deployed.'));
    }

    const clientBrandedToken = await new ClientBrandedTokenModel().select('*').where(['id=?', oThis.brandedTokenId]);
    const brandedToken = clientBrandedToken[0];

    if (brandedToken.client_id != oThis.clientId) {
      return Promise.resolve(responseHelper.error('l_ob_sw_5', 'Unauthorised request'));
    }

    const existingWorkerManagedAddresses = await new ClientWorkerManagedAddressIdsModel().getInActiveByClientId(oThis.clientId);
    var managedAddressIdClientWorkerAddrIdMap = {};
    for(var i=0; i<existingWorkerManagedAddresses.length; i++) {
      managedAddressIdClientWorkerAddrIdMap[parseInt(existingWorkerManagedAddresses[i].managed_address_id)] = existingWorkerManagedAddresses[i].id;
    }
    const managedAddresses = await new ManagedAddressModel().select('*')
      .where(['id in (?)', Object.keys(managedAddressIdClientWorkerAddrIdMap)]).fire();

    for(var i=0; i<managedAddresses.length; i++) {
      oThis.workerAddressesIdMap[managedAddresses[i].ethereum_address] = managedAddressIdClientWorkerAddrIdMap[managedAddresses[i].id];
    }

    if (Object.keys(oThis.workerAddressesIdMap).length == 0) {
      return Promise.resolve(responseHelper.error('l_ob_sw_6', 'Worker address is mandatory.'));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = SetWorkerKlass;