'use strict';
/**
 * To associate process from client in client_worker_managed_address_id
 *
 * @module lib/execute_transaction_management/associate_worker
 *
 */
const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  RmqQueueHelperKlass = require(rootPrefix + '/helpers/rmq_queue'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  RmqQueueConstants = require(rootPrefix + '/lib/global_constant/rmq_queue'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  configStrategyHelper = require(rootPrefix + '/helpers/config_strategy/by_client_id'),
  CommandMessageModelConstant = require(rootPrefix + '/lib/global_constant/command_message'),
  ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association'),
  processQueueAssociationConst = require(rootPrefix + '/lib/global_constant/process_queue_association'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id'),
  rmqQueueHelper = new RmqQueueHelperKlass();

require(rootPrefix + '/lib/providers/notification');

/**
 *
 * Constructor
 *
 * @param params
 * @param {number} params.clientId
 * @param {Array} params.processIds
 *
 * @constructor
 */
const AssociateWorker = function(params) {
  const oThis = this;

  if (!params.clientId || !params.processIds) {
    logger.error('Wrong input params.');
    process.exit(1);
  }

  oThis.clientId = params.clientId;
  oThis.processIds = params.processIds;

  oThis.clientChainId = null;
  oThis.openStNotification = null;
  oThis.workingClientsMap = {};
  oThis.processDetailsMap = {};
  oThis.workingClientWorkers = [];
  oThis.availableClientWorkers = [];
  oThis.workingClientProcessIds = [];
};

AssociateWorker.prototype = {
  /**
   * perform
   *
   * @return {Promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error('lib/execute_transaction_management/associate_worker catch');
      logger.error(error);
      process.exit(1);
    });
  },

  /**
   *
   * Starting point for associating multiple clients to a single process.
   *
   * @returns {Promise<void>}
   */
  asyncPerform: async function() {
    const oThis = this;

    await oThis.getNotificationObject(); // Step one.

    // Get available workers for the passed clientId.
    await oThis.getAndValidateAvailableWorkers(); // Step two.

    // Get final process details and validate those details. The process details being returned are of the
    // new available processes.
    await oThis.getAndValidateProcessDetails(); // Step three.

    // Validate all the existing active workers of the client.
    await oThis.validateAllWorkers(); // Step four.

    // Update status of active workers to blocking.
    await oThis.markBlockingStatus(); // Step five.

    // Associate available worker client to process.
    await oThis.associateAvailableWorker(); // Step six.

    // Wait for message to be sent to working processes.
    await oThis.sendBlockingMessage(); // Step seven.

    // Clear cache so that all the further messages for the client are distributed properly.
    await rmqQueueHelper.clearProcessRelatedCache(oThis.clientId); // Step eight.
  },

  /**
   *
   * Get openst-notification object.
   *
   * @returns {Promise<void>}
   */
  getNotificationObject: async function() {
    const oThis = this;

    let configStrategyHelperObj = new configStrategyHelper(oThis.clientId),
      configStrategy = await configStrategyHelperObj.get().catch(function(err) {
        logger.error('Could not fetch configStrategy. Error: ', err);
        return Promise.reject();
      });

    configStrategy = configStrategy.data;
    let ic = new InstanceComposer(configStrategy);

    const notificationProvider = ic.getNotificationProvider();
    oThis.openStNotification = notificationProvider.getInstance();

    logger.step('OpenSt-notification object created.');
  },

  /**
   *
   * Get available workers for the clientId, i.e. worker which is not associated with any process.
   * It also checks if the processes being passed are not already associated to the client already.
   *
   * @returns {Promise<void>}
   *
   */
  getAndValidateAvailableWorkers: async function() {
    const oThis = this;

    // Declare variables.
    let newProcessIds = oThis.processIds;

    // Fetch available workers for the client being passed.
    const availableClientWorkers = await new ClientWorkerManagedAddressIdModel()
      .getAvailableByClientIds([oThis.clientId])
      .catch(function() {
        // This checks that at least one worker is available for the clientId passed.
        logger.error(
          'Workers for the following client are unavailable: ' +
            oThis.clientId +
            '. Please add new workers to continue further.'
        );
        process.exit(1);
      });

    // This checks that the processIds being passed should not be associated with any worker of the client.
    let clientWorkersProcesses = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where(['client_id=? AND process_id IN (?)', oThis.clientId, oThis.processIds])
      .fire();

    if (clientWorkersProcesses.length > 0) {
      logger.error(
        'Workers of the client ',
        oThis.clientId,
        ' are already associated with some of given processes.\n',
        clientWorkersProcesses
      );
      process.exit(1);
    }

    // Fetch client chainId.
    oThis.clientChainId = await new ClientBrandedTokenModel()
      .select('chain_id')
      .where({ client_id: oThis.clientId })
      .fire();
    oThis.clientChainId = oThis.clientChainId[0].chain_id;

    // Update processIds array based on number of available workers.
    if (newProcessIds.length > availableClientWorkers[oThis.clientId].length) {
      newProcessIds = oThis.processIds.slice(0, availableClientWorkers[oThis.clientId].length);
      logger.warn(
        'The number of processes passed are less than the number of available workers for the client.',
        'Limiting the processes to the number of available workers.'
      );
      logger.warn('ProcessIds passed: ', oThis.processIds, '. ProcessIds being used: ', newProcessIds);
    }

    oThis.processIds = newProcessIds;
    oThis.availableClientWorkers = availableClientWorkers[oThis.clientId];

    logger.step('Available workers validated.');
  },

  /**
   *
   * Fetch process details for all the processes associated with the working processes
   * and apply validations for processIds being passed.
   *
   * @returns {Promise<void>}
   */
  getAndValidateProcessDetails: async function() {
    // Declare variables.
    const oThis = this;
    let count = 0,
      nonExistentProcessIds = [],
      invalidProcessesDueToChainId = [],
      invalidProcessesDueToUnavailableStatus = [];

    // Fetch process details.
    let processDetailsMap = await new ProcessQueueAssociationModel().getByProcessIds(oThis.processIds);

    // Validate processIds.
    Object.keys(processDetailsMap).forEach(function(key) {
      count++;
      let processDetail = processDetailsMap[key];
      if (processDetail.status !== processQueueAssociationConst.availableForAllocations) {
        invalidProcessesDueToUnavailableStatus.push(processDetail);
      }

      if (processDetail.chain_id !== oThis.clientChainId) {
        invalidProcessesDueToChainId.push(processDetail);
      }
    });

    // All the processIds passed should have an entry in process_queue_association table.
    if (count !== oThis.processIds.length) {
      for (let i = 0; i < oThis.processIds.length; i++) {
        if (!processDetailsMap[oThis.processIds[i]]) {
          nonExistentProcessIds.push(oThis.processIds[i]);
        }
      }
      logger.error(
        'The processIds do not exist in the process_queue_association table.',
        nonExistentProcessIds,
        '. Please choose other processes.'
      );
      process.exit(1);
    }

    if (invalidProcessesDueToUnavailableStatus.length > 0) {
      logger.error(
        'The following processes are unavailable for further allocations.',
        invalidProcessesDueToUnavailableStatus,
        '. Please choose other processes.'
      );
      process.exit(1);
    }

    if (invalidProcessesDueToChainId.length > 0) {
      logger.error(
        'The chainID of the client and the following processes do not match.',
        invalidProcessesDueToChainId,
        '. Please choose other processes.'
      );
      process.exit(1);
    }

    oThis.processDetailsMap = processDetailsMap;

    logger.step('Process details validated.');
  },

  /**
   *
   * This method checks whether there is any worker of a particular client which is in either blocking or hold status.
   *
   * @returns {Promise<Array>}
   */
  validateAllWorkers: async function() {
    // Declare variables.
    const oThis = this;

    // Fetches all workers which are not available: active, hold, and blocking.
    const workingClientWorkers = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where(['client_id=? AND process_id IS NOT NULL', oThis.clientId])
      .fire();

    let workersWithInvalidStatuses = [],
      invalidStatuses = [
        +new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.blockingStatus],
        +new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.holdStatus]
      ];
    // Implicit string to int conversion in the invalidStatuses array.

    for (let index = 0; index < workingClientWorkers.length; index++) {
      let workingClientWorker = workingClientWorkers[index];

      if (invalidStatuses.includes(workingClientWorker.status)) {
        workersWithInvalidStatuses.push(workingClientWorker);
      }
    }

    if (workersWithInvalidStatuses.length > 0) {
      logger.error(
        'The following workers are on either hold or blocking status: ',
        workersWithInvalidStatuses,
        '. Cannot continue further.'
      );
      process.exit(1);
    }

    oThis.workingClientWorkers = workingClientWorkers;
    logger.step('None of the workers are in hold or blocking status.');
  },

  /**
   *
   * Updates the status of working (active) workers to blocking.
   *
   * @returns {Promise<void>}
   */
  markBlockingStatus: async function() {
    const oThis = this;

    // Loop over all working workers and fetch all the required information before updating their statuses to blocking.
    for (let index = 0; index < oThis.workingClientWorkers.length; index++) {
      let workingClientWorker = oThis.workingClientWorkers[index];

      oThis.workingClientsMap[workingClientWorker.process_id] =
        oThis.workingClientsMap[workingClientWorker.process_id] || [];
      oThis.workingClientsMap[workingClientWorker.process_id].push(workingClientWorker);

      // Process Ids of working clients.
      oThis.workingClientProcessIds.push(workingClientWorker.process_id);
    }

    // Mark all currently running workers as blocking for given client.
    await new ClientWorkerManagedAddressIdModel()
      .update([
        'status = ?',
        new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.blockingStatus]
      ])
      .where(['client_id=(?) AND process_id IS NOT NULL AND process_id NOT IN (?)', oThis.clientId, oThis.processIds])
      .fire();

    logger.step('Running workers marked as blocking in the DB.');
  },

  /**
   *
   * Associate available workers of clients to the passed processId.
   *
   * @returns {Promise<void>}
   */
  associateAvailableWorker: async function() {
    const oThis = this;

    for (let index = 0; index < oThis.processIds.length; index++) {
      let processId = oThis.processIds[index],
        workerDetails = oThis.availableClientWorkers[index];

      // Associate process to the worker.
      await new ClientWorkerManagedAddressIdModel().updateProcessId({
        id: workerDetails.id,
        process_id: processId
      });

      logger.step('Associated process:', processId, ' to client workers in the DB.');

      // Fetch process details.
      let processDetail = oThis.processDetailsMap[processId],
        topicName =
          RmqQueueConstants.executeTxTopicPrefix + processDetail.chain_id + '.' + processDetail.queue_name_suffix;

      // Prepare message to be sent to transaction executing queues of kind goOnHold.
      // client_worker_managed_id is the table id.
      const payload = {
        client_worker_managed_id: workerDetails.id,
        client_id: workerDetails.client_id,
        original_status: workerDetails.status,
        command_kind: CommandMessageModelConstant.goOnHold
      };

      const message = { kind: RmqQueueConstants.commandMsg, payload: payload };

      // Publish the message to the transaction executing queues.
      await oThis.openStNotification.publishEvent
        .perform({
          topics: [topicName],
          publisher: 'OST1',
          message: message
        })
        .catch(function(err) {
          logger.error(
            'Message for associating worker on transaction executing queues was not published. Payload: ',
            payload,
            ' Error: ',
            err
          );
        });

      logger.step('Process association messages sent.');
    }
  },

  /**
   *
   * Send blocking messages to all the active workers for the client.
   *
   * @returns {Promise<void>}
   */
  sendBlockingMessage: async function() {
    // Declare variables.
    const oThis = this;

    // Fetch process details for all the processes associated with the working processes.
    const processDetailsMap = await new ProcessQueueAssociationModel().getByProcessIds(oThis.workingClientProcessIds);

    // Send commandMessage of kind markBlockingToOriginalStatus to all the queues associated with the working processes.
    for (let index = 0; index < oThis.workingClientProcessIds.length; index++) {
      let processId = oThis.workingClientProcessIds[index],
        processDetails = processDetailsMap[processId],
        workerDetails = oThis.workingClientsMap[processId];

      let topicName =
        RmqQueueConstants.executeTxTopicPrefix + processDetails.chain_id + '.' + processDetails.queue_name_suffix;

      // Prepare message to be sent to transaction executing queues of kind markBlockingToOriginalStatus.
      // client_worker_managed_id is the table id.
      const payload = {
        client_worker_managed_id: workerDetails[0].id,
        client_id: workerDetails[0].client_id,
        original_status: workerDetails[0].status,
        command_kind: CommandMessageModelConstant.markBlockingToOriginalStatus
      };

      const message = { kind: RmqQueueConstants.commandMsg, payload: payload };

      // Publish the message to command_message(Distributor Queue Consumer) queue.
      await oThis.openStNotification.publishEvent
        .perform({
          topics: [topicName],
          publisher: 'OST1',
          message: message
        })
        .catch(function(err) {
          logger.error(
            'Message for associating worker on command_message queue was not published. Payload: ',
            payload,
            ' Error: ',
            err
          );
        });
    }

    return Promise.resolve({});
  }
};

module.exports = AssociateWorker;
