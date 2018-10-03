'use strict';

/**
 * Run this process when any execute_transaction subscriber comes up.
 *
 * @module lib/execute_transaction_management/init_process
 *
 */

const rootPrefix = '../..',
  ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id');

/**
 * constructor
 *
 * @param {Object} params
 * @param {Integer} params.process_id - Process id that is going to start.
 *
 * @constructor
 */
const initProcessKlass = function(params) {
  const oThis = this;
  oThis.processId = params.process_id;
  oThis.responseData = {
    processDetails: [],
    shouldStartTxQueConsume: 1
  };
};

initProcessKlass.prototype = {
  /**
   * perform
   *
   * @return {Promise}
   */
  perform: async function() {
    const oThis = this;

    await oThis.getProcessDetails();

    await oThis.getHoldWorkers();

    // Check and decide process consumption.
    return Promise.resolve(oThis.responseData);
  },

  /**
   * Get process details.
   *
   * @return {Promise}
   */
  getProcessDetails: async function() {
    const oThis = this;
    oThis.responseData.processDetails = await new ProcessQueueAssociationModel().getByProcessId(oThis.processId);
    return Promise.resolve({});
  },

  /**
   * Get all hold workers.
   *
   * @return {Promise}
   */
  getHoldWorkers: async function() {
    const oThis = this,
      getAllHoldWorkersResp = await new ClientWorkerManagedAddressIdModel()
        .select('*')
        .where({
          process_id: oThis.processId,
          status: await new ClientWorkerManagedAddressIdModel().invertedStatuses[
            clientWorkerManagedAddressConst.holdStatus
          ]
        })
        .fire();

    let clientIds = [];
    for (var i = 0; i < getAllHoldWorkersResp.length; i++) {
      clientIds.push(getAllHoldWorkersResp[i].client_id);
    }
    let getAllBlockingWorkersResp = await new ClientWorkerManagedAddressIdModel()
      .select('*')
      .where({
        process_id: oThis.processId,
        status: await new ClientWorkerManagedAddressIdModel().invertedStatuses[
          clientWorkerManagedAddressConst.blockingStatus
        ]
      })
      .fire();

    if (getAllHoldWorkersResp.length > 0 && getAllBlockingWorkersResp > 0) {
      oThis.responseData.shouldStartTxQueConsume = 0;
    } else if (getAllHoldWorkersResp.length > 0) {
      let activeStatus = await new ClientWorkerManagedAddressIdModel().invertedStatuses[
        clientWorkerManagedAddressConst.activeStatus
      ];
      await new ClientWorkerManagedAddressIdModel()
        .update({ status: activeStatus })
        .where({
          process_id: oThis.processId,
          status: await new ClientWorkerManagedAddressIdModel().invertedStatuses[
            clientWorkerManagedAddressConst.holdStatus
          ]
        })
        .fire();
    }

    return Promise.resolve({});
  }
};

module.exports = initProcessKlass;
