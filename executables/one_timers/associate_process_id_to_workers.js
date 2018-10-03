'use strict';

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association'),
  processQueueAssocConst = require(rootPrefix + '/lib/global_constant/process_queue_association'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  ClientWorkerManagedAddressIdConstant = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id');

const associateProcessId = function() {};

associateProcessId.prototype = {
  /**
   *
   * Associates all available processes to existing clients.
   *
   * @returns {Promise<void>}
   */
  associate: async function() {
    // Get all the process_ids that are available for allocation and store them in array.
    const processDetails = await new ProcessQueueAssociationModel().getProcessesByStatus(
        processQueueAssocConst.availableForAllocations
      ),
      processArray = [];

    for (let i = 0; i < processDetails.length; i++) {
      processArray.push(processDetails[i].process_id);
    }
    // Get all the workers with active status.
    let activeStatus = await new ClientWorkerManagedAddressIdModel().invertedStatuses[
        ClientWorkerManagedAddressIdConstant.activeStatus
      ],
      clientDetails = await new ClientWorkerManagedAddressIdModel()
        .select('id, client_id, managed_address_id')
        .where(['status=?', activeStatus])
        .fire();

    let clientWorkersMap = {};

    for (let index = 0; index < clientDetails.length; index++) {
      let clientId = clientDetails[index].client_id;
      clientWorkersMap[clientId] = clientWorkersMap[clientId] || [];
      clientWorkersMap[clientId].push(clientDetails[index]);
    }

    // Assign the process_ids, here every process_id will have only one worker of the same client.
    // Update the entry for the same.
    for (let client in clientWorkersMap) {
      let clientWorkers = clientWorkersMap[client],
        minOfTwoArrays = Math.min(clientWorkers.length, processArray.length);

      for (let index = 0; index < minOfTwoArrays; index++) {
        let updateParams = {
          id: clientWorkers[index].id,
          process_id: processArray[index]
        };
        await new ClientWorkerManagedAddressIdModel().updateProcessId(updateParams);
      }
    }
    logger.win('Associated processes to all client workers successfully.');
    process.exit(0);
  }
};

module.exports = associateProcessId;
