'use strict';

/**
 * set multiple worker addresses to workers contract.
 *
 * @module lib/on_boarding/set_workers
 *
 */

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  CriticalChainInteractionLogModel = require(rootPrefix + '/app/models/critical_chain_interaction_log'),
  criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  OnBoardingRouter = require(rootPrefix + '/lib/on_boarding/router'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general);

require(rootPrefix + '/lib/providers/payments');

/**
 *
 * @constructor
 *
 * @param {object} params - external passed parameters
 * @param {number} params.critical_interaction_log_id - id of deploy airdrop contract row
 * @param {number} params.parent_critical_interaction_log_id - id of propose bt row
 *
 */
const SetWorkersKlass = function(params) {
  const oThis = this;

  oThis.criticalChainInteractionLogId = parseInt(params.critical_interaction_log_id);
  oThis.parentCriticalInteractionLogId = parseInt(params.parent_critical_interaction_log_id);

  oThis.criticalChainInteractionLog = null;
  oThis.parentCriticalChainInteractionLog = null;

  oThis.brandedTokenId = null;
  oThis.clientId = null;

  oThis.deactivationHeight = basicHelper
    .convertToBigNumber(10)
    .toPower(18)
    .toString(10);

  oThis.workerAddressesIdMap = {};
};

SetWorkersKlass.prototype = {
  /**
   * Perform
   *
   * @return {promise<result>}
   */
  perform: async function() {
    const oThis = this,
      r = null;

    return oThis.asyncPerform().catch(function(error) {
      var errorObj = null;

      // something unhandled happened
      logger.error('lib/on_boarding/set_workers.js::perform::catch');
      logger.error(error);

      if (responseHelper.isCustomResult(error)) {
        errorObj = error;
      } else {
        errorObj = responseHelper.error({
          internal_error_identifier: 'l_ob_sw_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: { error: error, clientId: oThis.clientId },
          error_config: errorConfig
        });
      }

      if (oThis.criticalChainInteractionLog) {
        new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
          oThis.criticalChainInteractionLog.id,
          {
            status: new CriticalChainInteractionLogModel().invertedStatuses[
              criticalChainInteractionLogConst.failedStatus
            ],
            response_data: errorObj.toHash()
          },
          oThis.parentCriticalInteractionLogId,
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
  asyncPerform: async function() {
    const oThis = this,
      paymentsProvider = oThis.ic().getPaymentsProvider(),
      configStrategy = oThis.ic().configStrategy,
      openSTPayments = paymentsProvider.getInstance(),
      PaymentsSetWorkersKlass = openSTPayments.services.workers.setWorker;

    await oThis.setCriticalChainInteractionLog();

    await oThis.validateAndSanitize();

    new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
      oThis.criticalChainInteractionLogId,
      {
        status: new CriticalChainInteractionLogModel().invertedStatuses[criticalChainInteractionLogConst.pendingStatus]
      },
      oThis.parentCriticalInteractionLogId,
      oThis.clientTokenId
    );

    var workerAddrs = Object.keys(oThis.workerAddressesIdMap),
      promiseResolvers = [],
      promiseResponses = [],
      formattedPromiseResponses = {},
      successWorkerAddrIds = [],
      promise = null,
      setWorkerObj = null;

    for (var i = 0; i < workerAddrs.length; i++) {
      setWorkerObj = new PaymentsSetWorkersKlass({
        workers_contract_address: configStrategy.OST_UTILITY_WORKERS_CONTRACT_ADDRESS,
        sender_address: configStrategy.OST_UTILITY_OPS_ADDR,
        sender_passphrase: configStrategy.OST_UTILITY_OPS_PASSPHRASE,
        worker_address: workerAddrs[i],
        deactivation_height: oThis.deactivationHeight,
        gas_price: configStrategy.OST_UTILITY_GAS_PRICE,
        chain_id: configStrategy.OST_UTILITY_CHAIN_ID,
        options: { returnType: 'txReceipt' }
      });

      promise = setWorkerObj.perform();

      promiseResolvers.push(promise);
    }

    promiseResponses = await Promise.all(promiseResolvers);

    for (var i = 0; i < promiseResolvers.length; i++) {
      var r = promiseResponses[i];
      if (r.isFailure()) {
        logger.notify('l_sw_2', 'Set Worker Failed', r, { clientId: oThis.clientId });
      } else {
        r.data['status'] = transactionLogConst.processingStatus;
        formattedPromiseResponses[oThis.workerAddressesIdMap[workerAddrs[i]]] = r.data;
        successWorkerAddrIds.push(oThis.workerAddressesIdMap[workerAddrs[i]]);
      }
    }

    if (successWorkerAddrIds.length == 0) {
      const errorRsp = responseHelper.error({
        internal_error_identifier: 'l_ob_sw_2',
        api_error_identifier: 'could_not_set_worker',
        debug_options: { data: formattedPromiseResponses },
        error_config: errorConfig
      });
      return Promise.reject(errorRsp);
    }

    await new ClientWorkerManagedAddressIdModel().markStatusActive(successWorkerAddrIds);

    const rspForDb = responseHelper.successWithData(formattedPromiseResponses);

    new CriticalChainInteractionLogModel().updateCriticalChainInteractionLog(
      oThis.criticalChainInteractionLog.id,
      {
        status: new CriticalChainInteractionLogModel().invertedStatuses[
          criticalChainInteractionLogConst.processedStatus
        ],
        response_data: rspForDb.toHash()
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
  setCriticalChainInteractionLog: async function() {
    const oThis = this,
      criticalChainInteractionLogs = await new CriticalChainInteractionLogModel().getByIds([
        oThis.criticalChainInteractionLogId,
        oThis.parentCriticalInteractionLogId
      ]),
      criticalChainInteractionLog = criticalChainInteractionLogs[oThis.criticalChainInteractionLogId],
      parentCriticalChainInteractionLog = criticalChainInteractionLogs[oThis.parentCriticalInteractionLogId];

    if (!criticalChainInteractionLog) {
      const errorRsp = responseHelper.error({
        internal_error_identifier: 'l_ob_sw_3',
        api_error_identifier: 'data_not_found',
        error_config: errorConfig
      });
      return Promise.reject(errorRsp);
    }

    if (!parentCriticalChainInteractionLog) {
      const errorRsp = responseHelper.error({
        internal_error_identifier: 'l_ob_sw_4',
        api_error_identifier: 'data_not_found',
        error_config: errorConfig
      });
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
  validateAndSanitize: async function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    oThis._criticalLogDebug('* Validating set workers params', 'debug');
    if (!oThis.brandedTokenId || !oThis.clientId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_sw_5',
          api_error_identifier: 'invalid_params',
          error_config: errorConfig
        })
      );
    }

    if (!configStrategy.OST_UTILITY_WORKERS_CONTRACT_ADDRESS) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_sw_6',
          api_error_identifier: 'workers_contract_not_found',
          error_config: errorConfig
        })
      );
    }

    oThis._criticalLogDebug('* Fetching client branded token details', 'debug');
    const clientBrandedToken = await new ClientBrandedTokenModel()
      .select('*')
      .where(['id=?', oThis.brandedTokenId])
      .fire();
    const brandedToken = clientBrandedToken[0];

    if (brandedToken.client_id != oThis.clientId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_sw_7',
          api_error_identifier: 'client_branded_token_not_found',
          error_config: errorConfig
        })
      );
    }

    oThis.tokenSymbol = brandedToken.symbol;

    oThis._criticalLogDebug('* Fetching client worker managed addresses', 'debug');

    const existingWorkerManagedAddresses = await new ClientWorkerManagedAddressIdModel().getInActiveByClientId(
      oThis.clientId
    );
    var managedAddressIdClientWorkerAddrIdMap = {};
    for (var i = 0; i < existingWorkerManagedAddresses.length; i++) {
      managedAddressIdClientWorkerAddrIdMap[parseInt(existingWorkerManagedAddresses[i].managed_address_id)] =
        existingWorkerManagedAddresses[i].id;
    }

    oThis._criticalLogDebug('* Fetching managed address details', 'debug');

    const managedAddresses = await new ManagedAddressModel()
      .select('*')
      .where(['id in (?)', Object.keys(managedAddressIdClientWorkerAddrIdMap)])
      .fire();

    for (var i = 0; i < managedAddresses.length; i++) {
      oThis.workerAddressesIdMap[managedAddresses[i].ethereum_address] =
        managedAddressIdClientWorkerAddrIdMap[managedAddresses[i].id];
    }

    if (Object.keys(oThis.workerAddressesIdMap).length == 0) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_ob_sw_8',
          api_error_identifier: 'workers_addresses_mandatory',
          error_config: errorConfig
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  _criticalLogDebug: function(message, messageKind) {
    const oThis = this;
    let parentId = oThis.parentCriticalInteractionLogId || '-';
    logger[messageKind].apply(logger, ['[p' + parentId + '][s' + oThis.criticalChainInteractionLogId + ']', message]);
  }
};

InstanceComposer.registerShadowableClass(SetWorkersKlass, 'getSetWorkersClass');

module.exports = SetWorkersKlass;
