'use strict';

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
  ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association'),
  processQueueAssocConst = require(rootPrefix + '/lib/global_constant/process_queue_association'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id');

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
    );

    let chainIdProcessesMap = {};
    for (let i = 0; i < processDetails.length; i++) {
      let processDetail = processDetails[i];
      chainIdProcessesMap[processDetail.chain_id] = chainIdProcessesMap[processDetail.chain_id] || [];
      chainIdProcessesMap[processDetail.chain_id].push(processDetail.process_id);
    }

    let availableClients = await new ClientBrandedTokenModel().select('chain_id, client_id').fire(),
      allClients = [],
      chainIdClientsMap = {};
    for (let index = 0; index < availableClients.length; index++) {
      let availableClient = availableClients[index];
      chainIdClientsMap[availableClient.chain_id] = chainIdClientsMap[availableClient.chain_id] || [];
      chainIdClientsMap[availableClient.chain_id].push(availableClient.client_id);
      allClients.push(availableClient.client_id);
    }

    // Get all the workers with active status.
    let activeStatus = new ClientWorkerManagedAddressIdModel().invertedStatuses[
        clientWorkerManagedAddressConst.activeStatus
      ],
      clientDetails = await new ClientWorkerManagedAddressIdModel()
        .select('id, client_id, managed_address_id')
        .where(['status=? AND client_id IN (?)', activeStatus, allClients])
        .fire();

    let clientWorkersMap = {};

    for (let index = 0; index < clientDetails.length; index++) {
      let clientId = clientDetails[index].client_id;
      clientWorkersMap[clientId] = clientWorkersMap[clientId] || [];
      clientWorkersMap[clientId].push(clientDetails[index]);
    }

    // Assign the process_ids, here every process_id will have only one worker of the same client.
    // Update the entry for the same.
    for (let chainId in chainIdClientsMap) {
      let associatedClients = chainIdClientsMap[chainId],
        processArray = chainIdProcessesMap[chainId];

      for (let index = 0; index < associatedClients.length; index++) {
        let clientId = associatedClients[index],
          clientWorkers = clientWorkersMap[clientId];

        if (clientWorkers === undefined) {
          continue;
        }

        let minOfTwoArrays = Math.min(clientWorkers.length, processArray.length);

        for (let index = 0; index < minOfTwoArrays; index++) {
          let updateParams = {
            id: clientWorkers[index].id,
            process_id: processArray[index]
          };
          await new ClientWorkerManagedAddressIdModel().updateProcessId(updateParams);
        }
      }
    }
    logger.win('Associated processes to all client workers successfully.');
    process.exit(0);
  }
};

new associateProcessId().associate().then();
