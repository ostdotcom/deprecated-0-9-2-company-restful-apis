'use strict';

const rootPrefix = '../..',
  ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id');

const initProcessKlass = function(params) {
  this.processId = params.process_id;
  this.responseData = {
    processDetails: null,
    shouldStartTxQueConsume: true
  };
};

initProcessKlass.prototype = {
  perform: async function() {
    const oThis = this;

    await oThis.getProcessDetails();

    await oThis.getHoldWorkers();

    // Check and decide Process consumption
    return Promise.resolve(oThis.responseData);
  },

  // Get process details.
  getProcessDetails: async function() {
    const oThis = this;
    oThis.responseData.processDetails = await new ProcessQueueAssociationModel.getByProcessId(oThis.processId);
    return Promise.resolve({});
  },

  // Get hold all workers.
  getHoldWorkers: async function() {
    const oThis = this,
      getAllWorkersResp = await new ClientWorkerManagedAddressIdModel.select('count(*)')
        .where({
          process_id: oThis.processId,
          status: ClientWorkerManagedAddressIdModel.invertedStatuses[clientWorkerManagedAddressConst.holdStatus]
        })
        .fire();

    if (getAllWorkersResp.length > 0) {
      oThis.responseData.shouldStartTxQueConsume = false;
    }

    return Promise.resolve({});
  }
};

module.exports = initProcessKlass;
