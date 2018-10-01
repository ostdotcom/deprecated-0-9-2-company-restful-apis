'use strict';

// Load external packages.
const openSTNotification = require('@openstfoundation/openst-notification');

const rootPrefix = '../..',
  RmqQueueHelperKlass = require(rootPrefix + '/helpers/rmq_queue'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  RmqQueueConstants = require(rootPrefix + '/lib/global_constant/rmq_queue'),
  CommandMessageModelConstant = require(rootPrefix + '/lib/global_constant/command_message'),
  ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association'),
  processQueueAssociationConst = require(rootPrefix + '/lib/global_constant/process_queue_association'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  ClientWorkerManagedAddressIdConstant = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id'),
  rmqQueueHelper = new RmqQueueHelperKlass();

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
const AssociateOneClientMultipleProcesses = function(params) {
  const oThis = this;

  if (!params.clientId || !params.processIds) {
    logger.error('Wrong input params.');
    process.exit(1);
  }

  oThis.clientId = params.clientId;
  oThis.processIds = params.processIds;

  oThis.workingClientsMap = {};
  oThis.processDetailsMap = {};
  oThis.workingClientWorkers = [];
  oThis.availableClientWorkers = [];
  oThis.workingClientProcessIds = [];
};

AssociateOneClientMultipleProcesses.prototype = {
  /**
   * perform
   *
   * @return {Promise<result>}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error('lib/execute_transaction_management/associate_one_client_to_multiple_processes catch');
      logger.error(error);
    });
  },

  /**
   * Add a record in the process_queue_association table.
   *
   * @param params
   *        {number} - params.process_id: processId to be added.
   *        {number} - params.rmq_config_id: rmqId to be added.
   *        {string} - params.topic_name: topicName to be added.
   *        {string} - params.status: status to be added.
   * @return {*}
   */
  createNewProcess: async function(params) {
    if (!params.status) {
      params.status = processQueueAssociationConst.processKilled;
    }
    await new ProcessQueueAssociationModel()
      .insertRecord(params)
      .then(function() {
        logger.win('Process entry created in the table.');
      })
      .catch(function() {
        logger.error('Process entry could not be created in the table.');
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

    // Get available workers for the passed clientId.
    await oThis.getAndValidateAvailableWorkers();

    // Get final process details and validate those details. The process details being returned are of the
    // new available processes.
    await oThis.getAndValidateProcessDetails();

    // Validate all the existing active workers of the client.
    await oThis.validateAllWorkers();

    // Associate available worker client to process.
    await oThis.associateAvailableWorker();

    // Update status of active workers to blocking.
    await oThis.markBlockingStatus();

    // Wait for message to be sent to working processes.
    await oThis.sendBlockingMessage();

    // Clear cache so that all the further messages for the client are distributed properly.
    await rmqQueueHelper.clearProcessRelatedCache(oThis.clientId);
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
    let invalidProcesses = [];

    // Fetch process details.
    let processDetailsMap = await new ProcessQueueAssociationModel().getByProcessIds(oThis.processIds);
    if (oThis.isEmptyObject(processDetailsMap)) {
      logger.error('The processIds do not exist in the process_queue_association table.');
      process.exit(1);
    }

    // Validate processIds.
    Object.keys(processDetailsMap).forEach(function(key) {
      let processDetail = processDetailsMap[key];
      if (processDetail.status !== processQueueAssociationConst.availableForAllocations) {
        invalidProcesses.push(processDetail);
      }
    });

    if (invalidProcesses.length > 0) {
      logger.error(
        'The following processes are unavailable for further allocations.',
        invalidProcesses,
        '. Please choose other processes.'
      );
      process.exit(1);
    }

    oThis.processDetailsMap = processDetailsMap;
    return Promise.resolve({});
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
        +new ClientWorkerManagedAddressIdModel().invertedStatuses[ClientWorkerManagedAddressIdConstant.blockingStatus],
        +new ClientWorkerManagedAddressIdModel().invertedStatuses[ClientWorkerManagedAddressIdConstant.holdStatus]
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
  },

  /**
   *
   * Associated available workers of clients to the passed processId.
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

      // Fetch process details.
      let processDetail = oThis.processDetailsMap[processId],
        topicName = RmqQueueConstants.executeTxTopicPrefix + processDetail.queue_name_suffix;

      // Prepare message to be sent to transaction executing queues of kind
      const payload = {
        client_worker_managed_id: workerDetails.managed_address_id,
        client_id: workerDetails.client_id,
        original_status: workerDetails.status,
        command_kind: CommandMessageModelConstant.goOnHold
      };

      const message = { kind: RmqQueueConstants.commandMsg, payload: payload };

      // Publish the message to the transaction executing queues.
      await openSTNotification.publishEvent
        .perform({ topics: [topicName], publisher: 'OST1', message: message })
        .then(logger.debug, logger.error);
    }
  },

  /**
   *
   * Updates the status of working workers to blocking.
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
        new ClientWorkerManagedAddressIdModel().invertedStatuses[ClientWorkerManagedAddressIdConstant.blockingStatus]
      ])
      .where(['client_id=(?) AND process_id IS NOT NULL AND process_id NOT IN (?)', oThis.clientId, oThis.processIds])
      .fire();
  },

  /**
   *
   * Send blocking messages to all the active workers for the client.
   *
   * @returns {Promise<void>}
   *
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

      let topicName = RmqQueueConstants.executeTxTopicPrefix + processDetails.queue_name_suffix;

      // Prepare message to be sent to transaction executing queues of kind
      const payload = {
        client_worker_managed_id: workerDetails[0].managed_address_id,
        client_id: workerDetails[0].client_id,
        original_status: workerDetails[0].status,
        command_kind: CommandMessageModelConstant.markBlockingToOriginalStatus
      };

      const message = { kind: RmqQueueConstants.commandMsg, payload: payload };

      // Publish the message to command_message(Distributor Queue Consumer) queue.
      await openSTNotification.publishEvent
        .perform({ topics: [topicName], publisher: 'OST1', message: message })
        .then(logger.debug, logger.error);
    }

    return Promise.resolve({});
  },

  /**
   *
   * Checks whether an object is empty or not
   *
   * @param obj
   * @returns {boolean}
   */
  isEmptyObject: function(obj) {
    return !Object.keys(obj).length;
  }
};

module.exports = AssociateOneClientMultipleProcesses;
