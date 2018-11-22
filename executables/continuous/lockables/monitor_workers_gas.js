'use strict';
/**
 * This script monitors the ST Prime balance of the workers associated with all clients.
 * If ST Prime falls bellow certain expected limit, It transfers ST Prime
 * If the ST Prime transfer is successful, it updates the property to hasStPrimeBalanceProperty
 * If the ST Prime transfer is unsuccessful, it de-associates that worker.
 * Also, if certain client does not have any worker associated with it, it rejects all of the execute tx request from that client.
 *
 * Usage: node executables/continuous/lockables/monitor_workers_gas.js 9
 *
 *
 * @module node executables/continuous/lockables/monitor_workers_gas
 */

const rootPrefix = '../../..';

// Always include module overrides first.
require(rootPrefix + '/module_overrides/index');

const baseKlass = require(rootPrefix + '/executables/continuous/lockables/base'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  configStrategyHelper = require(rootPrefix + '/helpers/config_strategy/by_client_id'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  CronProcessesHandler = require(rootPrefix + '/lib/cron_processes_handler'),
  CronProcessHandlerObject = new CronProcessesHandler(),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes'),
  ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association'),
  associateWorker = require(rootPrefix + '/lib/execute_transaction_management/associate_worker'),
  deAssociateWorker = require(rootPrefix + '/lib/execute_transaction_management/deassociate_worker'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id'),
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  hasStPrimeBalanceProperty = new ClientWorkerManagedAddressIdModel().invertedProperties[
    clientWorkerManagedAddressConst.hasStPrimeBalanceProperty
  ],
  invertedReserveAddressType = new ManagedAddressModel().invertedAddressTypes[managedAddressesConst.reserveAddressType],
  WORKER_MINIMUM_BALANCE_REQUIRED = 0.5;

require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/lib/cache_management/client_branded_token');

const usageDemo = function() {
  logger.log('Usage:', 'node ./executables/continuous/lockables/monitor_workers_gas.js processLockId');
  logger.log(
    '* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.'
  );
};

// Declare variables.
const args = process.argv,
  processLockId = args[2],
  cronKind = CronProcessesConstants.monitorWorkersGas;

let runCount = 1,
  monitorWorkerCron;

if (!processLockId) {
  logger.error('Process Lock id NOT passed in the arguments.');
  usageDemo();
  process.exit(1);
}

/**
 *
 * @constructor
 */
const MonitorGasOfWorkersKlass = function(params) {
  const oThis = this;

  oThis.startClientId = params.fromClientId;
  oThis.endClientId = params.endClientId;
  oThis.clientIdRange = [];

  oThis._init();

  Object.assign(params);

  baseKlass.call(oThis, params);
  SigIntHandler.call(oThis, { id: processLockId });
};

MonitorGasOfWorkersKlass.prototype = Object.create(baseKlass.prototype);
Object.assign(MonitorGasOfWorkersKlass.prototype, SigIntHandler.prototype);

const MonitorGasOfWorkersKlassPrototype = {
  /**
   * Init everything
   */
  _init: function() {
    const oThis = this;
    oThis.currentTime = Math.floor(new Date().getTime() / 1000);
    oThis.lockId = new Date().getTime();
    oThis.clientIdToWorkerIdsMap = {};
    oThis.workerIdToAddressMap = {};
    oThis.clientLowBalanceWorkerIds = {};
    oThis.clientIdToICPlatform = {};
    oThis.clientIdTochainIdMap = {};
    oThis.underProcessClientWorkers = [];
  },

  /**
   * Execute
   *
   * @return {Promise<result>}
   */
  execute: async function() {
    const oThis = this;

    await oThis._getWorkersForClient();

    await oThis._getWorkerAddresses();

    await oThis._monitorClientWorkersBalance();
  },

  /**
   * Sets the lockId for this particular process.
   *
   * @returns {number}
   */
  getLockId: function() {
    const oThis = this;
    return parseFloat(oThis.lockId + '.' + oThis.processId);
  },

  /**
   * Returns the model to be used.
   *
   * @returns {*}
   */
  getModel: function() {
    return ClientWorkerManagedAddressIdModel;
  },

  /**
   * Returns the whereClause array.
   *
   * @returns {*[]}
   */
  lockingConditions: function() {
    const oThis = this;

    let whereClause = [],
      cwmaModel = new ClientWorkerManagedAddressIdModel(),
      hasInitialGasProperty =
        cwmaModel.invertedProperties[clientWorkerManagedAddressConst.initialGasTransferredProperty],
      activeWorkerStatus = cwmaModel.invertedStatuses[clientWorkerManagedAddressConst.activeStatus];

    if (oThis.startClientId && oThis.endClientId) {
      whereClause = ['client_id >= ? AND client_id <= ? AND ', oThis.startClientId, oThis.endClientId];
    }

    whereClause[0] = whereClause[0] || '';
    whereClause[0] += 'status = ? AND next_action_at <= ? AND properties = properties | ?';
    whereClause.push(activeWorkerStatus);
    whereClause.push(oThis.currentTime);
    whereClause.push(hasInitialGasProperty);

    return whereClause;
  },

  /**
   * Items to update during lock.
   *
   * @returns {*[]}
   */
  updateItems: function() {},

  /**
   * Gets the max number of rows to be processed.
   *
   * @returns {Number}
   */
  getNoOfRowsToProcess: function() {
    const oThis = this;

    return 20;
  },

  /**
   * This function creates clients to workers map using client ids range.
   *
   * @returns {Promise<void>}
   * @private
   */
  _getWorkersForClient: async function() {
    const oThis = this;

    // Fetch all workers of client, so that deactivated workers can be re-activated.
    oThis.underProcessClientWorkers = await new ClientWorkerManagedAddressIdModel()
      .select('client_id, managed_address_id')
      .where(['lock_id = ?', oThis.getLockId()])
      .fire();

    for (let i = 0; i < oThis.underProcessClientWorkers.length; i++) {
      let rawResponse = oThis.underProcessClientWorkers[i];
      oThis.clientIdToWorkerIdsMap[rawResponse.client_id] = oThis.clientIdToWorkerIdsMap[rawResponse.client_id] || [];
      oThis.clientIdToWorkerIdsMap[rawResponse.client_id].push(rawResponse.managed_address_id);
      oThis.workerIdToAddressMap[rawResponse.managed_address_id] = null;
    }
    logger.log('===clientIdToWorkerIdsMap=====\n', oThis.clientIdToWorkerIdsMap);
  },

  /**
   * This function returns the address of clientWorkers.
   *
   * @private
   */
  _getWorkerAddresses: async function() {
    const oThis = this;

    let workerIds = Object.keys(oThis.workerIdToAddressMap),
      batchSize = 200;

    while (workerIds.length) {
      let wIds = workerIds.splice(0, batchSize),
        queryResponse = await new ManagedAddressModel().getByIds(wIds);

      for (let i = 0; i < queryResponse.length; i++) {
        let rawResponse = queryResponse[i];
        oThis.workerIdToAddressMap[rawResponse.id] = rawResponse.ethereum_address;
      }
    }

    logger.log('====workerIdToAddressMap=====\n', oThis.workerIdToAddressMap);
  },

  /**
   * This function fetches client instance composer.
   *
   * @returns {Promise<void>}
   * @private
   */
  _getClientPlatformInstance: async function(clientId) {
    const oThis = this;

    if (oThis.clientIdToICPlatform[clientId]) {
      return oThis.clientIdToICPlatform[clientId];
    }

    let configStrategyHelperObj = new configStrategyHelper(clientId),
      configStrategyResponse = await configStrategyHelperObj.get();

    let configStrategy = configStrategyResponse.data,
      ic = new InstanceComposer(configStrategy);

    oThis.clientIdTochainIdMap[clientId] = oThis.clientIdTochainIdMap[clientId] || [];
    oThis.clientIdTochainIdMap[clientId] = configStrategy['OST_UTILITY_CHAIN_ID'];
    oThis.clientIdToICPlatform[clientId] = ic.getPlatformProvider().getInstance();

    return oThis.clientIdToICPlatform[clientId];
  },

  /**
   * This method marks the property of the client workers as low STPrime balance.
   *
   * @param clientId
   * @param workerId
   * @returns {Promise<any>}
   * @private
   */
  _markSTPrimeBalanceLow: async function(clientId, workerId) {
    const oThis = this;

    let platformObj = await oThis._getClientPlatformInstance(clientId),
      minBal = basicHelper.convertToWei(WORKER_MINIMUM_BALANCE_REQUIRED);

    return new Promise(function(onResolve, onReject) {
      new platformObj.services.balance.simpleTokenPrime({ address: oThis.workerIdToAddressMap[workerId] })
        .perform()
        .then(function(workerBalanceRsp) {
          let bal = basicHelper.convertToBigNumber(workerBalanceRsp.data.balance);
          if (bal.lessThan(minBal)) {
            oThis.clientLowBalanceWorkerIds[clientId] = oThis.clientLowBalanceWorkerIds[clientId] || [];
            oThis.clientLowBalanceWorkerIds[clientId].push(workerId);
          }
          return onResolve();
        })
        .catch(function() {
          return onResolve();
        });
    });
  },

  /**
   * This function grants STPrime from the reserveAddress to the client workers.
   *
   * @param clientId
   * @param reserveAddress
   * @returns {Promise<void>}
   * @private
   */
  _grantSTPrimeFromReserve: async function(clientId, reserveAddress) {
    const oThis = this;

    let platformObj = await oThis._getClientPlatformInstance(clientId),
      workerIds = oThis.clientLowBalanceWorkerIds[clientId],
      reserveBalanceResp = await new platformObj.services.balance.simpleTokenPrime({
        address: reserveAddress
      }).perform(),
      reserveBalance = basicHelper.convertToBigNumber(reserveBalanceResp.data.balance),
      balanceToTransfer = basicHelper.transferSTPrimeToWorker();

    let deassociateWorkers = [],
      workerGotBalance = [];
    for (let i = 0; i < workerIds.length; i++) {
      let wi = workerIds[i],
        workerAddr = oThis.workerIdToAddressMap[wi];

      // Reserve Balance is more than balance to grant to worker
      if (reserveBalance.greaterThan(balanceToTransfer)) {
        const transferParams = {
          sender_address: reserveAddress,
          sender_passphrase: 'testtest',
          recipient_address: workerAddr,
          amount_in_wei: balanceToTransfer,
          options: { returnType: 'txReceipt', tag: '' }
        };

        logger.step('Transferring ST Prime from reserve to worker with low balance.');
        const resp = await new platformObj.services.transaction.transfer.simpleTokenPrime(transferParams).perform();

        if (resp.isSuccess()) {
          reserveBalance.minus(balanceToTransfer);
          workerGotBalance.push(wi);
        } else {
          deassociateWorkers.push(wi);
        }
      } else {
        deassociateWorkers.push(wi);
      }
    }

    // Associate client workers to running processes
    if (workerGotBalance.length) {
      logger.step('Association started');
      await oThis._associateWorkerProcesses(clientId, workerGotBalance);
    }

    // De-Associate client workers from processes
    if (deassociateWorkers.length) {
      logger.step('Disassociating Workers', deassociateWorkers);
      await oThis._dissociateClientWorkers(clientId, deassociateWorkers);
    }

    return Promise.resolve();
  },

  /**
   * This function associates the client workers of the clientId to available processes.
   *
   * @param clientId
   * @param associateWorkers
   * @returns {Promise<{}>}
   * @private
   */
  _associateWorkerProcesses: async function(clientId, associateWorkers) {
    const oThis = this;

    logger.step('Updating workers property as hasStPrimeBalance for workers', associateWorkers);
    // Update worker has gas now.
    await new ClientWorkerManagedAddressIdModel()
      .update(['properties = properties | ?', hasStPrimeBalanceProperty])
      .where(['managed_address_id IN (?)', associateWorkers])
      .fire();

    let chainId = oThis.clientIdTochainIdMap[clientId], // Extract the chainId from respective map
      processIdsResponse = await new ProcessQueueAssociationModel()
        .select(['process_id'])
        .where(['chain_id = ?', chainId])
        .fire();
    // Extract all the process_ids that belong to particular chain_id.

    let processIdArray = [];

    for (let index = 0; index < processIdsResponse.length; index++) {
      processIdArray.push(processIdsResponse[index].process_id);
    }

    // Extract the processes that are already associated with the given client_id.
    let associatedProcesses = await new ClientWorkerManagedAddressIdModel()
      .select(['process_id'])
      .where({ client_id: clientId })
      .fire();

    // Remove the processes that are already associated from processIdArray
    for (let i = 0; i < associatedProcesses.length; i++) {
      if (processIdArray.includes(associatedProcesses[i].process_id)) {
        let position = processIdArray.indexOf(associatedProcesses[i].process_id);
        processIdArray.splice(position, 1);
      }
    }

    // If all the processes are already associated then return
    if (processIdArray.length === 0) {
      return Promise.resolve({});
    }
    logger.step('Association started for clientId' + clientId + 'with processes' + processIdArray);
    // If some processes are not yet associated, associate them.
    let associateWorkerParams = {
        clientId: clientId,
        processIds: processIdArray
      },
      associateWorkerObj = await new associateWorker(associateWorkerParams);

    await associateWorkerObj.perform();
  },

  /**
   * This function disassociates the client workers of the clientId from their associated processes.
   *
   * @param clientId
   * @param workersIds
   * @returns {Promise<{}>}
   * @private
   */
  _dissociateClientWorkers: async function(clientId, workersIds) {
    const oThis = this;

    let processIdsArray = [],
      whereClauseForProcessIds = ['managed_address_id IN (?)', workersIds],
      processIdsQueryResponse = await new ClientWorkerManagedAddressIdModel()
        .select('process_id')
        .where(whereClauseForProcessIds)
        .fire();

    for (let index = 0; index < processIdsQueryResponse.length; index++) {
      if (processIdsQueryResponse[index].process_id != null) {
        processIdsArray.push(processIdsQueryResponse[index].process_id);
      }
    }

    if (processIdsArray.length === 0) {
      return Promise.resolve({});
    }
    let deAssociateParams = {
      clientId: clientId,
      processIds: processIdsArray
    };

    let deAssociateObject = await new deAssociateWorker(deAssociateParams);
    await deAssociateObject.perform();
  },

  _releaseLock: function(clientIds) {
    const oThis = this;
    let next_action_time = Math.floor(Date.now() / 1000) + 1200,
      updateOptions = ['next_action_at = ?', next_action_time];
    return new ClientWorkerManagedAddressIdModel().releaseLock(
      oThis.getLockId(),
      ['client_id IN (?)', clientIds],
      updateOptions
    );
  },

  /**
   * This function gets the balance of worker addresses.
   *
   * @returns {Promise<void>}
   * @private
   */
  _monitorClientWorkersBalance: async function() {
    const oThis = this;

    let clientIds = Object.keys(oThis.clientIdToWorkerIdsMap),
      batchSize = 10;

    while (clientIds.length) {
      let cids = clientIds.splice(0, batchSize);

      for (let i = 0; i < cids.length; i++) {
        let clientId = cids[i],
          workerIds = oThis.clientIdToWorkerIdsMap[clientId],
          workerBalancePromises = [];

        for (let wi = 0; wi < workerIds.length; wi++) {
          let workerId = workerIds[wi];
          workerBalancePromises.push(oThis._markSTPrimeBalanceLow(clientId, workerId));
        }
        await Promise.all(workerBalancePromises);
      }

      // Fetch client Reserve Addresses whose worker balance is low
      let lowBalanceClientIds = cids && Object.keys(oThis.clientLowBalanceWorkerIds);

      if (lowBalanceClientIds.length > 0) {
        let reserveAddressResp = await new ManagedAddressModel()
          .select('client_id, ethereum_address')
          .where(['client_id IN (?) AND address_type = ?', lowBalanceClientIds, invertedReserveAddressType])
          .fire();

        let transferBalancePromises = [];
        for (let i = 0; i < reserveAddressResp.length; i++) {
          let rap = reserveAddressResp[i];
          transferBalancePromises.push(oThis._grantSTPrimeFromReserve(rap.client_id, rap.ethereum_address));
        }
        await Promise.all(transferBalancePromises);
      }
      // Leave lock of client ids which are processed.
      await oThis._releaseLock(cids);
    }
  },

  /**
   * This function checks if there are any pending tasks left or not.
   *
   * @returns {boolean}
   */
  pendingTasksDone: function() {
    const oThis = this;
    return oThis.underProcessClientWorkers.length <= 0 && !oThis.lockAcquired;
  }
};

Object.assign(MonitorGasOfWorkersKlass.prototype, MonitorGasOfWorkersKlassPrototype);

const runTask = async function() {
  monitorWorkerCron._init();

  function onExecutionComplete() {
    // If too much load that iteration has processed full prefetch transactions, then don't wait for much time.
    let nextIterationTime =
      monitorWorkerCron.underProcessClientWorkers.length === monitorWorkerCron.getNoOfRowsToProcess() ? 10 : 120;
    monitorWorkerCron.underProcessClientWorkers = [];

    if (monitorWorkerCron.stopPickingUpNewWork || runCount >= 10) {
      // Executed 10 times now exiting
      logger.log(runCount + ' iteration is executed, Killing self now. ');
      process.emit('SIGINT');
    } else {
      logger.log(runCount + ' iteration is executed, Sleeping now for seconds ' + nextIterationTime / 1000);
      runCount = runCount + 1;
      setTimeout(runTask, nextIterationTime);
    }
  }
  monitorWorkerCron
    .perform()
    .then(function() {
      onExecutionComplete();
    })
    .catch(function() {
      onExecutionComplete();
    });
};

// Check whether the cron can be started or not.
CronProcessHandlerObject.canStartProcess({
  id: +processLockId, // Implicit string to int conversion.
  cron_kind: cronKind
}).then(async function(dbResponse) {
  let cronParams;

  try {
    cronParams = dbResponse.data.params;
    cronParams = cronParams === null ? {} : JSON.parse(cronParams);

    monitorWorkerCron = new MonitorGasOfWorkersKlass({
      process_id: processLockId,
      fromClientId: cronParams.start_client_id,
      endClientId: cronParams.end_client_id,
      release_lock_required: false
    });

    await runTask();
  } catch (err) {
    logger.error('Cron parameters stored in INVALID format in the DB.');
    logger.error(
      'The status of the cron was NOT changed to stopped. Please check the status before restarting the cron'
    );
    process.exit(1);
  }
});
