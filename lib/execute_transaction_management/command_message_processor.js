'use strict';

/**
 * Process command received, and take an action accordingly.
 *
 * @module lib/execute_transaction_management/command_message_processor
 *
 */
const openSTNotification = require('@openstfoundation/openst-notification');

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  rmqQueueConstants = require(rootPrefix + '/lib/global_constant/rmq_queue'),
  commandMessageConstants = require(rootPrefix + '/lib/global_constant/command_message'),
  ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id');

/**
 * constructor
 *
 * @param {Object} params
 * @param {Integer} params.message.payload - payload of the rmq message
 *                  {client_worker_managed_id:"1",client_id:"1001",original_status:"active",command_kind:"goOnHold"}
 *
 * @constructor
 */
const CommandMessageProcessor = function(params) {
  const oThis = this;
  oThis.commandMessage = params.message.payload;
  oThis.responseData = {};
};

CommandMessageProcessor.prototype = {
  /**
   * perform
   *
   * @return {Promise}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error(`${__filename}::perform::catch`);
      logger.error(error);
      return responseHelper.error(error);
    });
  },

  /**
   * Factory of commands
   *
   * @return {Promise}
   */
  asyncPerform: async function() {
    const oThis = this;

    if (oThis.commandMessage.command_kind === commandMessageConstants.markBlockingToOriginalStatus) {
      return oThis.executeMarkBlockingToOriginalStatusCommand();
    } else if (oThis.commandMessage.command_kind === commandMessageConstants.goOnHold) {
      return oThis.executeGoOnHoldCommand();
    } else if (oThis.commandMessage.command_kind === commandMessageConstants.goToOriginal) {
      return oThis.executeGoToOriginalCommand();
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Execute command to mark original status of worker process.
   * Also send command to all "Hold" process to check and un-hold self.
   *
   * @return {Promise}
   */
  executeMarkBlockingToOriginalStatusCommand: async function() {
    const oThis = this;

    let clWrkMng = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where({ id: oThis.commandMessage.client_worker_managed_id })
      .fire();

    // return if the worker process is not on "blockingStatus" status
    if (
      clWrkMng[0].status !==
      +new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.blockingStatus]
    ) {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    // mark status to "original"(active/inactive) status.
    await new ClientWorkerManagedAddressIdModel()
      .update(['status=?', oThis.commandMessage.original_status])
      .where({ id: oThis.commandMessage.client_worker_managed_id })
      .fire();

    // send "goToOriginal" command to workers having "holdStatus" status of given client.
    let siblingHoldWorkerProcesses = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where([
        'client_id=? AND status=?',
        clWrkMng[0].client_id,
        new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.holdStatus]
      ])
      .fire();

    for (let i = 0; i < siblingHoldWorkerProcesses.length; i++) {
      let workerProcess = siblingHoldWorkerProcesses[i];
      let queue_name_suffix = await oThis.getQueueTopicSuffix(workerProcess.process_id);

      let commandThroughRMQ = await openSTNotification.publishEvent.perform({
        topics: [rmqQueueConstants.commandMessageTopicPrefix + queue_name_suffix],
        publisher: 'OST1',
        message: {
          kind: rmqQueueConstants.commandMsg,
          payload: {
            client_worker_managed_id: workerProcess.id,
            client_id: workerProcess.client_id,
            original_status: clientWorkerManagedAddressConst.activeStatus,
            command_kind: commandMessageConstants.goToOriginal
          }
        }
      });
      logger.info('Publishing command to hold the queue ', commandThroughRMQ);
    }

    // Do Nothing with any of queue consumers.
    return Promise.resolve(responseHelper.successWithData({}));
  },

  /**
   * Execute command to mark worker process to go to "Hold", means stop txExecuteQueue consumption.
   * Before proceed first check any of sibling client_worker_process is on "BlockingStatus".
   *
   * @return {Promise}
   */
  executeGoOnHoldCommand: async function() {
    const oThis = this;

    let clWrkMng = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where({ id: oThis.commandMessage.client_worker_managed_id })
      .fire();

    // return if the worker process is already on "holdStatus" status
    if (
      clWrkMng[0].status ===
      +new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.holdStatus]
    ) {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    let siblingBlockingWorkerProcesses = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where([
        'client_id=? AND status=?',
        clWrkMng[0].client_id,
        new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.blockingStatus]
      ])
      .fire();

    // if any of sibling worker of the client is on status 'blockingStatus',
    // Change Status to 'holdStatus' and Stop consumption of the respective txQueue.
    if (siblingBlockingWorkerProcesses.length > 0) {
      await new ClientWorkerManagedAddressIdModel()
        .update([
          'status=?',
          new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.holdStatus]
        ])
        .where({ id: oThis.commandMessage.client_worker_managed_id })
        .fire();
    }

    return Promise.resolve(responseHelper.successWithData({ shouldStopTxQueConsume: 1 }));
  },

  /**
   * Execute command to mark worker process to release from "Hold", means start txExecuteQueue consumption.
   * Before proceed first check any of sibling client_worker_process is not on "BlockingStatus".
   *
   * @return {Promise}
   */
  executeGoToOriginalCommand: async function() {
    const oThis = this;

    let clWrkMng = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where({ id: oThis.commandMessage.client_worker_managed_id })
      .fire();

    // return if the worker process is not on "holdStatus" status
    if (
      clWrkMng[0].status !==
      +new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.holdStatus]
    ) {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    let siblingHoldWorkerProcesses = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where([
        'client_id=? AND status=?',
        clWrkMng[0].client_id,
        new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.blockingStatus]
      ])
      .fire();

    // return if any of sibling worker of the client is still on 'blockingStatus' status, because can not mark un-hold,
    // unless all blocking workers are resolved.
    if (siblingHoldWorkerProcesses.length > 0) {
      return Promise.resolve(responseHelper.successWithData({}));
    }

    // Change status to "originalStatus".
    await new ClientWorkerManagedAddressIdModel()
      .update(['status=?', oThis.commandMessage.original_status])
      .where({ id: oThis.commandMessage.client_worker_managed_id })
      .fire();

    // Start consumption of the respective txQueue.
    return Promise.resolve(responseHelper.successWithData({ shouldStartTxQueConsume: 1 }));
  },

  /**
   * get Queue topic suffix.
   *
   * @return {Promise}
   */
  getQueueTopicSuffix: async function(processId) {
    let processDetails = await new ProcessQueueAssociationModel().getByProcessId(processId);
    return Promise.resolve(processDetails.queue_name_suffix);
  }
};

module.exports = CommandMessageProcessor;