'use strict';
/**
 * This script monitors the ST Prime balance of the workers associated with all clients.
 * If ST Prime falls bellow certain expected limit, it de-associate that worker.
 * Also, if certain client does not have any worker associated with it, it rejects all of the execute tx request from that client.
 *
 * Usage: node executables/client_worker_process_management/monitor_workers_gas.js --startClientId 1 --endClientId 5
 *
 *
 * @module executables/client_worker_process_management/monitor_workers_gas
 */

const rootPrefix = '../../..',
  baseKlass = require(rootPrefix + '/executables/continuous/lockables/base'),
  command = require('commander'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses'),
  configStrategyHelper = require(rootPrefix + '/helpers/config_strategy/by_client_id'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.general),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  deAssociateWorker = require(rootPrefix + '/lib/execute_transaction_management/deassociate_worker'),
  SigIntHandler = require(rootPrefix + '/executables/sigint_handler'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  WORKER_MINIMUM_BALANCE_REQUIRED = 0.1;

require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/lib/cache_management/client_branded_token');

command
  .option('--startClientId [startClientId]', 'Start Client id')
  .option('--endClientId [endClientId]', 'End Client id')
  .option('--process-id <processId>', 'Process id');

command.on('--help', () => {
  console.log('');
  console.log('  Example:');
  console.log('');
  console.log(
    '    node ./executables/continuous/lockables/monitor_workers_gas.js --process-id 123 --startClientId 1 --endClientId 100 '
  );
  console.log('');
  console.log('');
});

command.parse(process.argv);

let runCount = 1;

// Validate and sanitize the commander parameters.
const validateAndSanitize = function() {
  if (!command.processId) {
    command.help();
    command.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

/**
 *
 * @constructor
 */
const MonitorGasOfWorkersKlass = function(params) {
  const oThis = this;

  oThis.lockId = Math.floor(new Date().getTime() / 1000);

  // oThis.startClientId = parseInt(command.startClientId);
  // oThis.endClientId = parseInt(command.endClientId);
  oThis.startClientId = params.from_client_id;
  oThis.endClientId = params.to_client_id;

  oThis.whereClause = [];
  oThis.reserveAddrObj = null;
  oThis.clientIdToWorkerIdsMap = {};
  oThis.workerIdToAddressMap = {};
  oThis.clientLowBalanceWorkerIds = {};
  oThis.clientIdToICPlatform = {};

  oThis.reserveAddress = '';

  Object.assign(params, { release_lock_required: false });

  baseKlass.call(oThis, params);
  SigIntHandler.call(oThis);
};

MonitorGasOfWorkersKlass.prototype = Object.create(baseKlass.prototype);
Object.assign(MonitorGasOfWorkersKlass.prototype, SigIntHandler.prototype);

const MonitorGasOfWorkersKlassPrototype = {
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

    return oThis._getClientIdsRange();
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

    return 1000;
  },

  /**
   * This function generates client range to be passed to get workers map.
   *
   * @returns {Promise<Array|*|*[]>}
   * @private
   */
  _getClientIdsRange: function() {
    const oThis = this;

    if (oThis.startClientId && oThis.endClientId) {
      oThis.whereClause = ['client_id >= ? AND client_id <= ? ', oThis.startClientId, oThis.endClientId];
    } else if (oThis.startClientId === undefined && oThis.endClientId) {
      oThis.whereClause = ['client_id <= ? ', oThis.endClientId];
    } else if (oThis.startClientId && oThis.endClientId === undefined) {
      oThis.whereClause = ['client_id >= ? ', oThis.startClientId];
    } else {
      oThis.whereClause = ['client_id >= ?', 1];
    }

    return oThis.whereClause;
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
    let queryResponse = await new ClientWorkerManagedAddressIdModel()
      .select('client_id, managed_address_id')
      .where(['lock_id = ?', oThis.getLockId()])
      .fire();

    for (let i = 0; i < queryResponse.length; i++) {
      let rawResponse = queryResponse[i];
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
      configStrategyResponse = await configStrategyHelperObj.get(),
      configStrategy = configStrategyResponse.data,
      ic = new InstanceComposer(configStrategy);

    oThis.clientIdToICPlatform[clientId] = ic.getPlatformProvider().getInstance();

    return oThis.clientIdToICPlatform[clientId];
  },

  _markSTPrimeBalanceLow: async function(clientId, workerId) {
    const oThis = this;

    let platformObj = await oThis._getClientPlatformInstance(clientId),
      minBal = basicHelper.convertToWei(WORKER_MINIMUM_BALANCE_REQUIRED);

    return new Promise(function(onResolve, onReject) {
      platformObj.services.balance
        .simpleTokenPrime({ address: oThis.workerIdToAddressMap[workerId] })
        .then(function(workerBalanceRsp) {
          let bal = basicHelper.convertToBigNumber(workerBalanceRsp.data.balance);
          if (bal.lessThan(minBal)) {
            oThis.clientLowBalanceWorkerIds[clientId] = oThis.clientLowBalanceWorkerIds[clientId] || [];
            oThis.clientLowBalanceWorkerIds[clientId].push(workerId);
          }
          return onResolve;
        })
        .catch(function() {
          return onResolve;
        });
    });
  },

  _grantSTPrimeFromReserve: async function(clientId, reserveAddress) {
    const oThis = this;

    let platformObj = await oThis._getClientPlatformInstance(clientId),
      workerIds = oThis.clientLowBalanceWorkerIds[clientId],
      reserveBalanceResp = await platformObj.services.balance.simpleTokenPrime({ address: reserveAddress }),
      reserveBalance = basicHelper.convertToBigNumber(reserveBalanceResp.data.balance),
      balanceToTransfer = basicHelper.transferSTPrimeToWorker();

    let deassociateWorkers = [];
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

        const transferSTPrimeBalanceObj = new platformObj.services.transfer.simpleTokenPrime(transferParams);
        const resp = await transferSTPrimeBalanceObj.perform();
        if (resp.isSuccess()) {
          reserveBalance.minus(balanceToTransfer);
          // Update worker has gas now.
        } else {
          deassociateWorkers.push(wi);
        }
      } else {
        deassociateWorkers.push(wi);
      }
    }

    if (deassociateWorkers.length) {
      await oThis._deassociateClientWorkers(clientId, deassociateWorkers);
    }

    return Promise.resolve();
  },

  _deassociateClientWorkers: async function(clientId, workersIds) {
    const oThis = this;

    let whereClauseForProcessIds = ['managed_address_id IN (?)', workersIds],
      processIdsQueryResponse = await new ClientWorkerManagedAddressIdModel()
        .select('process_id')
        .where(whereClauseForProcessIds)
        .fire(),
      deAssociateParams = {
        clientId: clientId,
        processIds: processIdsQueryResponse.processIds
      },
      deAssociateObject = new deAssociateWorker(deAssociateParams);

    let deAssociateResponse = deAssociateObject.perform();
  },

  _releaseLock: function(clientIds) {
    const oThis = this;
    new ClientWorkerManagedAddressIdModel.releaseLock(oThis.getLockId(), ['client_id IN (?)', clientIds]);
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
      batchSize = 10,
      clientLowBalanceWorkers = {};

    while (clientIds.length) {
      let cids = clientIds.splice(0, batchSize),
        workerBalancePromises = [];

      for (let i = 0; i < cids.length; i++) {
        let clientId = cids[i],
          workerIds = oThis.clientIdToWorkerIdsMap[clientId],
          workerBalancePromises = [];

        for (let wi = 0; wi < workerIds.length; wi++) {
          let workerId = workerIds[wi];
          workerBalancePromises.push(oThis._markSTPrimeBalanceLow(clientId, workerId));
        }
        await Promise.resolve(workerBalancePromises);
      }

      // Fetch client Reserve Addresses whose worker balance is low
      let lowBalanceClientIds = cids && Object.keys(oThis.clientLowBalanceWorkerIds);

      if (lowBalanceClientIds.length > 0) {
        let reserveAddressResp = await new ManagedAddressModel()
          .select('client_id, ethereum_address')
          .where([
            'client_id IN (?) AND address_type = ?',
            lowBalanceClientIds,
            managedAddressesConst.reserveAddressType
          ])
          .fire();
        let transferBalancePromises = [];
        for (let i = 0; i < reserveAddressResp.length; i++) {
          let rap = reserveAddressResp[i];
          transferBalancePromises.push(oThis._grantSTPrimeFromReserve(rap.client_id, rap.ethereum_address));
        }
        await Promise.resolve(transferBalancePromises);
      }
      // Leave lock of client ids which are processed.
      await oThis._releaseLock(cids);
    }
  },

  pendingTasksDone: function() {
    const oThis = this;
    return oThis.handlerPromises.length === 0;
  }
};

Object.assign(MonitorGasOfWorkersKlass.prototype, MonitorGasOfWorkersKlassPrototype);

let monitorWorkerCron = new MonitorGasOfWorkersKlass({
  process_id: command.processId,
  from_client_id: command.startClientId,
  to_client_id: command.endClientId,
  release_lock_required: false
});

const runTask = async function() {
  await monitorWorkerCron.perform();

  if (runCount >= 10) {
    // Executed 10 times now exiting
    console.log(runCount + ' iteration is executed, Killing self now. ');
    process.exit(1);
  } else {
    console.log(runCount + ' iteration is executed, Sleeping now for 2 minutes.');
    runCount = runCount + 1;
    setTimeout(runTask, 120000);
  }
};

runTask();
