'use strict';

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  commandMessageConstants = require(rootPrefix + '/lib/global_constant/command_message'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id'),
  rmqQueueConstants = require(rootPrefix + '/lib/global_constant/rmq_queue'),
  ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association');

const CommandMessageProcessor = function(params) {
  const oThis = this;
  oThis.commandMessage = oThis.messagePayload;
};

CommandMessageProcessor.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return Promise.resolve(
          responseHelper.error({
            internal_error_identifier: 'l_obg_as_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          })
        );
      }
    });
  },

  asyncPerform: async function() {
    await oThis.executeCommand();

    // identify and process command message
    return Promise.resolve();
  },

  executeCommand: async function() {
    const oThis = this;

    if (oThis.commandMessage.command_kind == commandMessageConstants.markBlockingToOriginalStatus) {
      return oThis.executeMarkBlockingToOriginalStatusCommand();
    } else if (oThis.commandMessage.command_kind == commandMessageConstants.goOnHold) {
      return oThis.executeGoOnHoldCommand();
    } else if (oThis.commandMessage.command_kind == commandMessageConstants.goToOriginal) {
      return oThis.executeGoToOriginalCommand();
    }
  },

  executeMarkBlockingToOriginalStatusCommand: async function() {
    const oThis = this;

    let clWrkMng = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where({ id: oThis.commandMessage.client_worker_managed_id })
      .fire();

    // return if the worker process is not on "blockingStatus" status
    if (clWrkMng.status != clientWorkerManagedAddressConst.blockingStatus) {
      return Promise.resolve();
    }

    // mark status to "original"(active/inactive) status.
    await new ClientWorkerManagedAddressIdModel()
      .update([
        'status=?',
        new ClientWorkerManagedAddressIdModel().invertedStatuses[oThis.commandMessage.original_status]
      ])
      .where({ id: oThis.commandMessage.client_worker_managed_id })
      .fire();

    // send "goToOriginal" command to workers having "holdStatus" status of given client.
    let siblingHoldWorkerProcesses = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where([
        'client_id=? AND status=?',
        clWrkMng.client_id,
        new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.holdStatus]
      ])
      .fire();

    for (var i = 0; i < siblingHoldWorkerProcesses.length; i++) {
      let workerProcess = siblingHoldWorkerProcesses[i];
      let queue_name_suffix = await oThis.getQueueTopicSuffix(workerProcess.process_id);

      let commandThroughRMQ = await openSTNotification.publishEvent.perform({
        topics: [rmqQueueConstants.commandMessageTopicPrefix + queue_name_suffix],
        publisher: 'OST_CMD',
        message: {
          kind: rmqQueueConstants.commandMsg,
          payload: {
            client_worker_managed_id: workerProcess.id,
            client_id: workerProcess.client_id,
            original_status: workerProcess.status,
            command_kind: commandMessageConstants.goToOriginal
          }
        }
      });
      logger.info('Publishing command to hold the queue ', commandThroughRMQ);
    }

    // Do Nothing with any of queue consumers.
    return Promise.resolve();
  },

  executeGoOnHoldCommand: async function() {
    const oThis = this;

    let clWrkMng = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where({ id: oThis.commandMessage.client_worker_managed_id })
      .fire();

    // return if the worker process is already on "holdStatus" status
    if (clWrkMng.status == clientWorkerManagedAddressConst.holdStatus) {
      return Promise.resolve();
    }

    let siblingHoldWorkerProcesses = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where([
        'client_id=? AND status=?',
        clWrkMng.client_id,
        new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.blockingStatus]
      ])
      .fire();

    // if any of sibling worker of the client is on status 'blockingStatus',
    // Change Status to 'holdStatus' and Stop consumption of the respective txQueue.
    if (siblingHoldWorkerProcesses.length > 0) {
      await new ClientWorkerManagedAddressIdModel()
        .update([
          'status=?',
          new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.holdStatus]
        ])
        .where({ id: oThis.commandMessage.client_worker_managed_id })
        .fire();
    }

    return Promise.resolve({ StopConsumption: 1 });
  },

  executeGoToOriginalCommand: async function() {
    const oThis = this;

    let clWrkMng = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where({ id: oThis.commandMessage.client_worker_managed_id })
      .fire();

    // return if the worker process is not on "holdStatus" status
    if (clWrkMng.status == clientWorkerManagedAddressConst.holdStatus) {
      return Promise.resolve();
    }

    let siblingHoldWorkerProcesses = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where([
        'client_id=? AND status=?',
        clWrkMng.client_id,
        new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.blockingStatus]
      ])
      .fire();
    // return if any of sibling worker of the client is still on 'blockingStatus' status, because can not mark unhold,
    // unless all blockings are resolved.
    if (siblingHoldWorkerProcesses.length > 0) {
      return Promise.resolve();
    }

    // Change status to "originalStatus".
    await new ClientWorkerManagedAddressIdModel()
      .update([
        'status=?',
        new ClientWorkerManagedAddressIdModel().invertedStatuses[oThis.commandMessage.original_status]
      ])
      .where({ id: oThis.commandMessage.client_worker_managed_id })
      .fire();

    // Start consumption of the respective txQueue.
    return Promise.resolve({ StopConsumption: 1 });
  },

  getQueueTopicSuffix: async function(processId) {
    let processDetails = await new ProcessQueueAssociationModel().getByProcessId(processId);
    return Promise.resolve(processDetails.queue_name_suffix);
  }
};

module.exports = CommandMessageProcessor;
