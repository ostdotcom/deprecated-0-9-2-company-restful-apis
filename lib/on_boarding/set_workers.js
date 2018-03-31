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
  , CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log')
  , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , OnBoardingRouter = require(rootPrefix + '/lib/on_boarding/router')
;

/**
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.critical_interaction_log_id - id of deploy airdrop contract row
 * @param {number} params.parent_critical_interaction_log_id - id of propose bt row
 *
 */
const SetWorkersKlass = function (params) {

  const oThis = this;

  oThis.criticalChainInteractionLogId = parseInt(params.critical_interaction_log_id);
  oThis.parentCriticalInteractionLogId = parseInt(params.parent_critical_interaction_log_id);

  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;

  oThis.brandedTokenId = null;
  oThis.clientId = null;

  oThis.workerContractAddress = chainIntConstants.UTILITY_WORKERS_CONTRACT_ADDRESS;
  oThis.senderAddress = chainIntConstants.UTILITY_OPS_ADDR;
  oThis.senderPassphrase = chainIntConstants.UTILITY_OPS_PASSPHRASE;
  oThis.chainId = chainIntConstants.UTILITY_CHAIN_ID;
  oThis.gasPrice = chainIntConstants.UTILITY_GAS_PRICE;

  oThis.deactivationHeight = basicHelper.convertToBigNumber(10).toPower(18).toString(10);

  oThis.workerAddressesIdMap = {};

};

SetWorkersKlass.prototype = {

  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function () {

    const oThis = this
      , r = null
    ;

    return oThis.asyncPerform()
        .catch(function (error) {

          var errorObj = null;

          if(responseHelper.isCustomResult(error)) {

            errorObj = error;

          } else {

            // something unhandled happened
            logger.error('lib/on_boarding/set_workers.js::perform::catch');
            logger.error(error);

            errorObj = responseHelper.error("l_sw_1", "Inside catch block", null, {error: error}, {sendErrorEmail: true});

          }

          if (oThis.criticalChainInteractionLog) {
            new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
              oThis.criticalChainInteractionLog.id,
              {status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.failedStatus], response_data: errorObj.toHash()},
              oThis.parentCriticalChainInteractionLogId,
              oThis.clientTokenId
            );
          }

          return errorObj;

      });

  },

  /**
   * Async perform
   *
   * @return {promise<result>}
   */
  asyncPerform: async function () {

    const oThis = this;

    await oThis.setCriticalChainInteractionLog();

    await oThis.validateAndSanitize();

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
        logger.notify('l_sw_2', 'Set Worker Failed', r.toHash);
      } else {
        r.data['status'] = transactionLogConst.processingStatus;
        formattedPromiseResponses[oThis.workerAddressesIdMap[workerAddrs[i]]] = r.data;
        successWorkerAddrIds.push(oThis.workerAddressesIdMap[workerAddrs[i]]);
      }
    }

    if (successWorkerAddrIds.length == 0) {
      const errorRsp = responseHelper.error(
          'l_sw_3', 'could not set any worker',
          null, {data: formattedPromiseResponses}
      );
      return Promise.reject(errorRsp);
    }

    await new ClientWorkerManagedAddressIdsModel().markStatusActive(successWorkerAddrIds);

    new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
        oThis.criticalChainInteractionLog.id,
        {
          status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.processedStatus],
          response_data: {data: formattedPromiseResponses}
        },
        oThis.parentCriticalChainInteractionLogId,
        oThis.clientTokenId
    );

    const callRouterRsp = await new OnBoardingRouter({
      current_step: 'set_workers',
      status: 'done',
      token_symbol: oThis.tokenSymbol,
      client_id: oThis.clientId,
      client_token_id: oThis.clientTokenId,
      parent_critical_interaction_log_id: oThis.parentCriticalInteractionLogId,
      client_branded_token_id: oThis.brandedTokenId
    }).perform();

    if (callRouterRsp.isFailure()) {
      return Promise.reject(callRouterRsp);
    }

    return Promise.resolve(responseHelper.successWithData({}));

  },

  /**
   * set critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  setCriticalChainInteractionLog: async function () {

    const oThis = this
        , criticalChainInteractionLogs = await new CriticalChainInteractionLogModel().getByIds([
            oThis.criticalChainInteractionLogId,
            oThis.parentCriticalInteractionLogId
          ])
        , criticalChainInteractionLog = criticalChainInteractionLogs[oThis.criticalChainInteractionLogId]
        , parentCriticalChainInteractionLog = criticalChainInteractionLogs[oThis.parentCriticalInteractionLogId]
    ;

    if (!criticalChainInteractionLog) {
      const errorRsp = responseHelper.error(
          "l_sw_3", "criticalChainInteractionLog not found",
          null, {}, {sendErrorEmail: false}
      );
      return Promise.reject(errorRsp);
    }

    if (!parentCriticalChainInteractionLog) {
      const errorRsp = responseHelper.error(
          "l_sw_4", "parentCriticalChainInteractionLog not found",
          null, {}, {sendErrorEmail: false}
      );
      return Promise.reject(errorRsp);
    }

    oThis.criticalChainInteractionLog = criticalChainInteractionLog;
    oThis.parentCriticalChainInteractionLog = parentCriticalChainInteractionLog;

    oThis.brandedTokenId = oThis.criticalChainInteractionLog.client_branded_token_id;
    oThis.clientId = oThis.criticalChainInteractionLog.client_id;
    oThis.clientTokenId = oThis.criticalChainInteractionLog.client_token_id;

    return Promise.resolve(responseHelper.successWithData({}));

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
      return Promise.reject(responseHelper.error('l_sw_5', 'Mandatory params missing.'));
    }

    if (!oThis.workerContractAddress) {
      return Promise.reject(responseHelper.error('l_sw_6', 'Mandatory to have Workers contract deployed.'));
    }

    const clientBrandedToken = await new ClientBrandedTokenModel().select('*').where(['id=?', oThis.brandedTokenId]).fire();
    const brandedToken = clientBrandedToken[0];

    if (brandedToken.client_id != oThis.clientId) {
      return Promise.reject(responseHelper.error('l_sw_7', 'Unauthorised request'));
    }

    oThis.tokenSymbol = brandedToken.symbol;

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
      return Promise.reject(responseHelper.error('l_sw_8', 'Worker address is mandatory.'));
    }

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

module.exports = SetWorkersKlass;