'use strict';

/**
 * This script will add workers for specified number of clients.
 * It will add 4 new workers by default.
 * This can be done in 2 ways -
 * 1. addition of workers can be done by specifying first and last client id (add workers for each client in this range).
 * 2. specify clientIds array to add workers for specific clients
 *
 * Usage: node executables/add_more_workers.js
 *
 * @module executables/add_more_workers
 */

const rootPrefix = '..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

const ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy/by_client_id');

require(rootPrefix + '/app/services/address/generate');
require(rootPrefix + '/lib/providers/payments');

/**
 * Add new workers constructor
 *
 * @param {object} params -
 * @param {number} params.startClientId - first client id for sequential addition of workers
 * @param {number} params.endClientId - last client id for sequential addition of workers
 * @param {array} [params.clientIds] - array of clientIds for whom workers to be added
 * @param {number} params.newWorkersCnt - number of workers to be added.
 *
 * @constructor
 *
 */

const addMoreWorkersKlass = function(params) {
  const oThis = this;
  oThis.startClientId = params['startClientId'];
  oThis.endClientId = params['endClientId'];
  oThis.clientIds = params['clientIds'];
  oThis.newWorkersCnt = params['newWorkersCnt'];

  oThis.clientIdSymbolMap = {};
  oThis.clientIdSetWorkerAddressesMap = {};

  oThis.workerContractAddress = null;
  oThis.senderAddress = null;
  oThis.senderPassphrase = null;
  oThis.chainId = null;
  oThis.gasPrice = null;

  oThis.deactivationHeight = basicHelper
    .convertToBigNumber(10)
    .toPower(18)
    .toString(10);
};

addMoreWorkersKlass.prototype = {
  /**
   * Perform
   *
   * @return {Promise<result>}
   */
  perform: async function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      let errorObj = null;

      // something unhandled happened
      logger.error('executables/add_more_workers.js::perform::catch');
      logger.error(error);

      if (responseHelper.isCustomResult(error)) {
        errorObj = error;
      } else {
        errorObj = responseHelper.error({
          internal_error_identifier: 'e_amw_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: { error: error },
          error_config: errorConfig
        });
      }

      return errorObj;
    });
  },

  asyncPerform: async function() {
    const oThis = this;

    let r = oThis.setclientIds();
    if (r.isFailure()) {
      return Promise.resolve(r);
    }

    r = await oThis.setclientIdSymbolMap();

    if (r.isFailure()) {
      return Promise.reject(r);
    }

    r = await oThis.generateWorkerAddresses();

    if (r.isFailure()) {
      return Promise.reject(r);
    }

    r = await oThis.associateWorkerAddresses();

    console.log('====r', r);
    return Promise.resolve(r);
  },

  setclientIds: function() {
    const oThis = this;

    if (oThis.clientIds && oThis.clientIds.length > 0) {
      return responseHelper.successWithData({});
    }

    if (!oThis.startClientId || !oThis.endClientId) {
      return responseHelper.error({
        internal_error_identifier: 'e_amw_2',
        api_error_identifier: 'invalid_params',
        error_config: errorConfig
      });
    }

    oThis.clientIds = [];

    for (let i = oThis.startClientId; i <= oThis.endClientId; i++) {
      oThis.clientIds.push(i);
    }

    logger.info('oThis.clientIds set: ', oThis.clientIds);
    return responseHelper.successWithData({});
  },

  generateWorkerAddresses: async function() {
    const oThis = this,
      dbFields = ['client_id', 'managed_address_id', 'status', 'created_at', 'updated_at'],
      currentTime = new Date();

    oThis.strategyMap = {};

    for (let j = 0; j < oThis.clientIds.length; j++) {
      let clientId = oThis.clientIds[j],
        managedAddressInsertData = [],
        newWorkerUuids = [];

      let configStrategyHelper = new ConfigStrategyHelperKlass(clientId),
        getConfigStrategyRsp = await configStrategyHelper.get();

      if (getConfigStrategyRsp.isFailure()) {
        return Promise.reject(getConfigStrategyRsp);
      }

      oThis.strategyMap[clientId] = getConfigStrategyRsp.data;

      let instanceComposer = new InstanceComposer(getConfigStrategyRsp.data);

      let GenerateEthAddressKlass = instanceComposer.getGenerateAddressClass();

      let generateEthAddress = new GenerateEthAddressKlass({
        address_type: managedAddressesConst.workerAddressType,
        client_id: clientId
      });

      for (let i = 0; i < oThis.newWorkersCnt; i++) {
        let r = await generateEthAddress.perform();

        if (r.isFailure()) {
          return Promise.reject(r);
        }

        const resultData = r.data[r.data.result_type];
        newWorkerUuids.push(resultData.id);
      }

      const manageAddrObjs = await new ManagedAddressModel().getByUuids(newWorkerUuids);
      for (let i = 0; i < manageAddrObjs.length; i++) {
        managedAddressInsertData.push([
          clientId,
          manageAddrObjs[i].id,
          new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.inactiveStatus],
          currentTime,
          currentTime
        ]);
      }

      await new ClientWorkerManagedAddressIdModel().insertMultiple(dbFields, managedAddressInsertData).fire();
    }

    logger.info('waiting for addresses to be generated');

    let wait = function() {
      return new Promise(function(onResolve, onReject) {
        setTimeout(function() {
          logger.info('addresses generated');
          onResolve(responseHelper.successWithData({}));
        }, 3000);
      });
    };

    return wait();
  },

  setclientIdSymbolMap: async function() {
    const oThis = this,
      clientBrandedTokens = await new ClientBrandedTokenModel().getByClientIds(oThis.clientIds);

    let clientBrandedToken = null;

    for (let i = 0; i < clientBrandedTokens.length; i++) {
      clientBrandedToken = clientBrandedTokens[i];
      oThis.clientIdSymbolMap[parseInt(clientBrandedToken.client_id)] = clientBrandedToken.symbol;
    }

    oThis.clientIds = Object.keys(oThis.clientIdSymbolMap); //replace ids as outside world might have passed invalid ids

    return responseHelper.successWithData({});
  },

  associateWorkerAddresses: async function() {
    const oThis = this;

    let clientId = null;

    for (let j = 0; j < oThis.clientIds.length; j++) {
      clientId = oThis.clientIds[j];

      let configStrategy = oThis.strategyMap[clientId];

      oThis.workerContractAddress = configStrategy.OST_UTILITY_WORKERS_CONTRACT_ADDRESS;
      oThis.senderAddress = configStrategy.OST_UTILITY_OPS_ADDR;
      oThis.senderPassphrase = configStrategy.OST_UTILITY_OPS_PASSPHRASE;
      oThis.chainId = configStrategy.OST_UTILITY_CHAIN_ID;
      oThis.gasPrice = configStrategy.OST_UTILITY_GAS_PRICE;

      logger.info('sending txs for clientId', clientId);

      let existingWorkerManagedAddresses = await new ClientWorkerManagedAddressIdModel().getInActiveByClientId(
          clientId
        ),
        managedAddressIdClientWorkerAddrIdMap = {},
        workerAddressesIdToUpdateMap = {};

      for (let i = 0; i < existingWorkerManagedAddresses.length; i++) {
        managedAddressIdClientWorkerAddrIdMap[parseInt(existingWorkerManagedAddresses[i].managed_address_id)] =
          existingWorkerManagedAddresses[i].id;
      }

      const managedAddresses = await new ManagedAddressModel()
        .select('*')
        .where(['id in (?)', Object.keys(managedAddressIdClientWorkerAddrIdMap)])
        .fire();

      for (let i = 0; i < managedAddresses.length; i++) {
        workerAddressesIdToUpdateMap[managedAddresses[i].ethereum_address] =
          managedAddressIdClientWorkerAddrIdMap[managedAddresses[i].id];
      }

      let workerAddrs = Object.keys(workerAddressesIdToUpdateMap),
        promiseResolvers = [],
        promiseResponses = [],
        formattedPromiseResponses = {},
        successWorkerAddrIds = [],
        setWorkerObj = null,
        promise = null;

      let instanceComposer = new InstanceComposer(configStrategy);
      let openStPayments = instanceComposer.getPaymentsProvider().getInstance();
      let SetWorkerKlass = openStPayments.services.workers.setWorker;

      for (let i = 0; i < workerAddrs.length; i++) {
        setWorkerObj = new SetWorkerKlass({
          workers_contract_address: oThis.workerContractAddress,
          sender_address: oThis.senderAddress,
          sender_passphrase: oThis.senderPassphrase,
          worker_address: workerAddrs[i],
          deactivation_height: oThis.deactivationHeight,
          gas_price: oThis.gasPrice,
          chain_id: oThis.chainId,
          options: { returnType: 'txReceipt' }
        });

        promise = setWorkerObj.perform();

        promiseResolvers.push(promise);
      }

      promiseResponses = await Promise.all(promiseResolvers);

      for (let i = 0; i < promiseResolvers.length; i++) {
        let r = promiseResponses[i];
        if (r.isFailure()) {
          logger.notify('l_sw_2', 'Set Worker Failed', r, { clientId: clientId });
        } else {
          formattedPromiseResponses[workerAddressesIdToUpdateMap[workerAddrs[i]]] = r.data;
          successWorkerAddrIds.push(workerAddressesIdToUpdateMap[workerAddrs[i]]);
        }
      }

      if (successWorkerAddrIds.length === 0) {
        const errorRsp = responseHelper.error({
          internal_error_identifier: 'e_amw_3',
          api_error_identifier: 'could_not_proceed',
          debug_options: { data: formattedPromiseResponses },
          error_config: errorConfig
        });
        return Promise.reject(errorRsp);
      }

      await new ClientWorkerManagedAddressIdModel().markStatusActive(successWorkerAddrIds);
    }

    return responseHelper.successWithData({});
  }
};

const obj = new addMoreWorkersKlass({ newWorkersCnt: 400, clientIds: [1230] });
obj.perform().then(function(r) {
  console.log('DONE! Result:', r);
  process.exit(0);
});
