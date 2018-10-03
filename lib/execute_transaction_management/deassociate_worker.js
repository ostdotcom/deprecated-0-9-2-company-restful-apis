'use strict';

const openSTNotification = require('@openstfoundation/openst-notification');

const rootPrefix = '../..',
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id'),
  ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association'),
  rmqQueueConstant = require(rootPrefix + '/lib/global_constant/rmq_queue'),
  commandMessageConstant = require(rootPrefix + '/lib/global_constant/command_message'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  rmqHelper = require(rootPrefix + '/helpers/rmq_queue');

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
const DeAssociateWorker = function(params) {
  const oThis = this;

  if (!params.clientId || !params.processIds) {
    logger.error('Either clientId or processIds are not present');
    process.exit(1);
  }

  oThis.clientId = params.clientId;
  oThis.processIds = params.processIds;

  oThis.idStatusMap = {};
  oThis.idArray = [];
};

DeAssociateWorker.prototype = {
  perform: async function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error('/lib/execute_transaction_management/deassociate_worker.js::perform::catch');
      logger.error(error);
      return Promise.resolve(error);
    });
  },

  /**
   * Methods for de-associating workers are called.
   *
   * @returns {Promise<void>}
   */
  asyncPerform: async function() {
    const oThis = this;

    await oThis._validateTemporaryStatus();

    await oThis._validate();

    await oThis._getProcessWorkerAssociationId();

    await oThis._removeProcessWorkerAssociation();

    await oThis._sendCommandMsg();

    await oThis._clearCache();
  },

  _validateTemporaryStatus: async function() {
    const oThis = this;

    // Fetches all workers which are not available: active, hold, and blocking.
    const workingClientWorkers = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where(['client_id=?', oThis.clientId])
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
  },

  /**
   * Checks if given client_id and process_id association exists or not
   *
   * @returns {Promise<void>}
   */
  _validate: async function() {
    const oThis = this;

    let clientId = oThis.clientId,
      processIdsArray = oThis.processIds;

    for (let i = 0; i < processIdsArray.length; i++) {
      let response = await new ClientWorkerManagedAddressIdModel()
        .select('*')
        .where(['client_id =? AND process_id =?', clientId, processIdsArray[i]])
        .fire();

      if (response.length === 0) {
        logger.error(
          'There is no such entry with client_id ' + oThis.clientId + ' and process_id ' + processIdsArray[i]
        );
        process.exit(1);
      }
    }
  },

  /**
   * Get an id of the worker whose association we want to remove.
   * This can be used later to update the status and send command messages.
   *
   * @returns {Promise<void>}
   */
  _getProcessWorkerAssociationId: async function() {
    const oThis = this;
    let clientId = oThis.clientId,
      processIdsArray = oThis.processIds,
      idsStatusMap = oThis.idStatusMap,
      idArray = oThis.idArray;

    for (let i = 0; i < processIdsArray.length; i++) {
      let getId = await new ClientWorkerManagedAddressIdModel()
        .select('id, status')
        .where({ client_id: clientId, process_id: processIdsArray[i] })
        .fire();
      idsStatusMap[getId[0].id] = getId[0].status;
      idArray.push(getId[0].id);
    }

    oThis.idStatusMap = idsStatusMap;
    oThis.idArray = idArray;
  },

  /**
   * Remove the process worker association in client_worker_managed_address_id table
   *
   * @returns {Promise<void>}
   */
  _removeProcessWorkerAssociation: async function() {
    const oThis = this;

    await new ClientWorkerManagedAddressIdModel()
      .update(['process_id = ?', null])
      .where(['id IN (?)', oThis.idArray])
      .fire();
  },

  /**
   * Mark the workers that needs to be de-associated blocking and send command message to there respective queues.
   * Also send the command message OnHold to sibling workers.
   *
   * @returns {Promise<void>}
   */
  _sendCommandMsg: async function() {
    const oThis = this;

    let clientId = oThis.clientId,
      idsArray = oThis.idArray,
      processIds = oThis.processIds,
      idStatusMap = oThis.idStatusMap;

    // Update status to blocking.
    let blockingStatus = await new ClientWorkerManagedAddressIdModel().invertedStatuses[
      clientWorkerManagedAddressConst.blockingStatus
    ];
    await new ClientWorkerManagedAddressIdModel()
      .update(['status = ?', blockingStatus])
      .where(['id IN (?)', idsArray])
      .fire();

    // Mark the current worker (the one we want to de-associate) Blocking and send the command message
    // on its execute transaction queue
    for (let i = 0; i < idsArray.length; i++) {
      // Get the queue_name_suffix.
      // We will use that later to get the subscription topic of queue.
      let currentQueueNameSuffix = await new ProcessQueueAssociationModel()
          .select('queue_name_suffix')
          .where(['id=?', processIds[i]])
          .fire(),
        queueSuffix = currentQueueNameSuffix[0].queue_name_suffix,
        clientWorkerManagedId = Object.keys(idStatusMap)[i],
        originalStatus = idStatusMap[clientWorkerManagedId];

      // client_worker_managed_id is the table id.
      let payload = {
          client_worker_managed_id: clientWorkerManagedId,
          client_id: clientId,
          original_status: originalStatus,
          command_kind: commandMessageConstant.markBlockingToOriginalStatus
        },
        queueTopic = rmqQueueConstant.executeTxTopicPrefix + queueSuffix,
        message = {
          kind: rmqQueueConstant.commandMsg,
          payload: payload
        };

      // Publish the message.
      let commandThroughRMQ = await openSTNotification.publishEvent.perform({
        topics: [queueTopic],
        publisher: 'OST_1',
        message: message
      });
      logger.info('Publishing command to the queue ', commandThroughRMQ);
    }

    // Get the process details of sibling workers.
    let processDetails = await new ClientWorkerManagedAddressIdModel()
      .select('id ,process_id,status')
      .where(['client_id=? AND process_id IS NOT NULL', clientId])
      .fire();

    for (let i = 0; i < processDetails.length; i++) {
      let currentRecord = processDetails[i],
        currentProcessId = currentRecord.process_id,
        currentQueNameSuffix = await new ProcessQueueAssociationModel()
          .select('queue_name_suffix')
          .where(['process_id=?', currentProcessId])
          .fire();

      // Send command messages to the sibling workers execute transaction queues to goOnHold.
      // client_worker_managed_id is the table id.
      let payload = {
          client_worker_managed_id: currentRecord.id,
          client_id: clientId,
          original_status: currentRecord.status,
          command_kind: commandMessageConstant.goOnHold
        },
        topicName = rmqQueueConstant.executeTxTopicPrefix + currentQueNameSuffix[0].queue_name_suffix;

      await openSTNotification.publishEvent
        .perform({
          topics: [topicName],
          publisher: 'OST_1',
          message: {
            kind: rmqQueueConstant.commandMsg,
            payload: payload
          }
        })
        .then(logger.debug(), logger.error());
    }
  },

  _clearCache: async function() {
    const oThis = this;
    let clientId = oThis.clientId;
    await new rmqHelper().clearProcessRelatedCache(clientId);
  }
};

module.exports = DeAssociateWorker;
