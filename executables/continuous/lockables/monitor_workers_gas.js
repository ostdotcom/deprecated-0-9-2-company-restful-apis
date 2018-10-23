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
  // command = require('commander'),
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
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/platform');
require(rootPrefix + '/lib/cache_management/client_branded_token');

// command
//   .option('--startClient-id [startClientId]', 'Start Client id')
//   .option('--endClient-id [endClientId]', 'End Client id');
//
// command.on('--help', () => {
//   console.log('');
//   console.log('  Example:');
//   console.log('');
//   console.log('    node ./executables/monitor_gas_of_workers.js --startClient-id --stopClient-id ');
//   console.log('');
//   console.log('');
// });
//
// command.parse(process.argv);

let configStrategy = {};

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
  oThis.clientToWorkersMap = {};
  oThis.workerToAddressMap = {};
  oThis.workersWhoseBalanceIsLowMap = {};

  oThis.reserveAddress = '';

  Object.assign(params, { release_lock_required: false });

  baseKlass.call(oThis, params);
};

MonitorGasOfWorkersKlass.prototype = Object.create(baseKlass.prototype);

const MonitorGasOfWorkersKlassPrototype = {
  /**
   * Execute
   *
   * @return {Promise<result>}
   */
  execute: async function() {
    const oThis = this;

    await oThis._getWorkersForClient();

    await oThis._getAddressOfWorkers();

    await oThis._getBalanceOfWorkerAddress();
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

    return oThis.noOfRowsToProcess || 1000;
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

    let queryResponse = await new ClientWorkerManagedAddressIdModel()
      .select('client_id, managed_address_id')
      .where(['lock_id = ?', oThis.getLockId()])
      .fire();

    for (let i = 0; i < queryResponse.length; i++) {
      let rawResponse = queryResponse[i];
      oThis.clientToWorkersMap[rawResponse.client_id] = oThis.clientToWorkersMap[rawResponse.client_id] || [];
      oThis.clientToWorkersMap[rawResponse.client_id].push(rawResponse.managed_address_id);
    }
    logger.log('===clientToWorkersMap=====\n', oThis.clientToWorkersMap);
  },

  /**
   * This function returns the address of clientWorkers.
   *
   * @returns {Promise<*|result>}
   * @private
   */
  _getAddressOfWorkers: async function() {
    const oThis = this;

    for (let clientId in oThis.clientToWorkersMap) {
      let workerIdsArray = oThis.clientToWorkersMap[clientId],
        queryResponse = await new ManagedAddressModel().getByIds(workerIdsArray);

      for (let i = 0; i < queryResponse.length; i++) {
        let rawResponse = queryResponse[i];
        oThis.workerToAddressMap[rawResponse.id] = rawResponse.ethereum_address;
      }
    }
    logger.log('====workerToAddressMap=====\n', oThis.workerToAddressMap);
    return responseHelper.successWithData({});
  },

  /**
   * This function gets the balance of worker addresses.
   *
   * @returns {Promise<void>}
   * @private
   */
  _getBalanceOfWorkerAddress: async function() {
    const oThis = this;

    for (let clientId in oThis.clientToWorkersMap) {
      let configStrategyHelperObj = new configStrategyHelper(clientId),
        configStrategyResponse = await configStrategyHelperObj.get().catch(function(err) {
          logger.error('Could not fetch configStrategy. Error: ', err);
        });

      configStrategy = configStrategyResponse.data;

      let instanceComposer = new InstanceComposer(configStrategy),
        openStPlatform = instanceComposer.getPlatformProvider().getInstance(),
        workerIdsArray = oThis.clientToWorkersMap[clientId];

      for (let index = 0; index < workerIdsArray.length; index++) {
        let workerId = workerIdsArray[index],
          workerEthAddress = oThis.workerToAddressMap[workerId],
          platformObj = new openStPlatform.services.balance.simpleTokenPrime({ address: workerEthAddress }),
          workerBalanceRsp = await platformObj.perform();

        let stPrimeBalanceBigNumber = basicHelper.convertToBigNumber(workerBalanceRsp.data.balance);

        //TODO:- compare balance with minimum using getMinimumSTPrimeLimitForClient function,
        //if gas is low, oThis.workersWhoseBalanceIsLowMap[clientId] = workerId;
        //currently, this is hardcoded value - 1

        if (stPrimeBalanceBigNumber.lessThan(basicHelper.convertToWei(0.1))) {
          oThis.workersWhoseBalanceIsLowMap[clientId] = workerId;

          logger.log('===oThis.workersWhoseBalanceIsLowMap====', oThis.workersWhoseBalanceIsLowMap);

          // if client has at least one worker with low gas, check balance of reserve,
          if (oThis.workersWhoseBalanceIsLowMap.length > 0) {
            let address_type = managedAddressesConst.reserveAddressType,
              whereClauseForReserveAddress = ['client_id = ? AND address_type = ?', clientId, address_type],
              queryResp = await new ManagedAddressModel()
                .select('client_id, ethereum_address')
                .where(whereClauseForReserveAddress)
                .fire();

            oThis.reserveAddrObj = queryResp['ethereum_address'];

            let response = await oThis._checkBalanceOfReserveAddress();

            // if reserve has balance-> transfer gas using platform service
            if (response.isSuccess()) {
              let transferAmountInWei = basicHelper.convertToWei(1),
                transferParams = {
                  sender_address: oThis.reserveAddrObj.ethereum_address,
                  sender_passphrase: 'testtest',
                  recipient_address: workerEthAddress,
                  amount_in_wei: transferAmountInWei,
                  options: { returnType: 'txReceipt', tag: '' }
                };

              const transferSTPrimeBalanceObj = new openStPlatform.services.transfer.simpleTokenPrime(transferParams);

              const transferSTPrimeResponse = await transferSTPrimeBalanceObj.perform();

              if (transferSTPrimeResponse.isFailure()) {
                return Promise.resolve(transferSTPrimeResponse);
              }
            }

            // if reserve has low balance-> de-associate that worker

            let whereClauseForProcessIds = ['managed_address_id = ?', workerId],
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

            if (deAssociateResponse.isFailure()) {
              return Promise.resolve(deAssociateResponse);
            }
          }
        }
      }
    }
  },

  /**
   * This function checks the balance of reserve address.
   *
   * @returns {Promise<*>}
   * @private
   */
  _checkBalanceOfReserveAddress: async function() {
    const oThis = this;

    let ethereumAddress = oThis.reserveAddrObj.ethereum_address,
      minReserveAddrBalanceToProceedInWei = basicHelper.reserveAlertBalanceWei(),
      platformProvider = oThis.ic().getPlatformProvider(),
      openSTPlaform = platformProvider.getInstance(),
      fetchBalanceObj = new openSTPlaform.services.balance.simpleTokenPrime({ address: ethereumAddress }),
      balanceResponse = await fetchBalanceObj.perform();

    if (balanceResponse.isFailure()) {
      return Promise.reject(balanceResponse);
    }

    const balanceBigNumberInWei = basicHelper.convertToBigNumber(balanceResponse.data.balance);

    if (balanceBigNumberInWei.lessThan(minReserveAddrBalanceToProceedInWei)) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'e_cwpm_mwg_1',
          api_error_identifier: 'something_went_wrong',
          error_config: errorConfig
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }
};

Object.assign(MonitorGasOfWorkersKlass.prototype, MonitorGasOfWorkersKlassPrototype);

InstanceComposer.registerShadowableClass(MonitorGasOfWorkersKlass, 'getMonitorWorkersGasKlass');

module.exports = MonitorGasOfWorkersKlass;
