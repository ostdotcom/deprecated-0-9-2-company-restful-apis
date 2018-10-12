'use strict';

/**
 * This file is used to kill a process. The code will dissociate all the clients associated to a particular process
 * and kills a process.
 * If a client associated with the said process is not associated to another process, that particular client won't be
 * dissociated with the process, but all the other associated clients will be dissociated. The process won't be killed
 * and an error message with a list of clients is printed on the console. The list of clients printed are those clients
 * which don't have
 *
 */

const rootPrefix = '../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association'),
  processQueueAssocConst = require(rootPrefix + '/lib/global_constant/process_queue_association'),
  disAssociateWorkerKlass = require(rootPrefix + '/lib/execute_transaction_management/deassociate_worker'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id');

const args = process.argv,
  processId = +args[2];

const run = async function() {
  let processWorkers = await new ClientWorkerManagedAddressIdModel()
    .select('*')
    .where({ process_id: processId })
    .fire();

  if (processWorkers.length === 0) {
    logger.error('No client is associated with the process.');
    process.exit(1);
  }

  let clientIds = [],
    clientAllWorkersMap = {},
    cannotDisassociateClient = [];

  for (let i = 0; i < processWorkers.length; i++) {
    clientIds.push(processWorkers[i].client_id);
  }

  let clientAllProcessWorkers = await new ClientWorkerManagedAddressIdModel()
    .select('*')
    .where(['client_id in (?)', clientIds])
    .fire();

  for (let i = 0; i < clientAllProcessWorkers.length; i++) {
    let clientProcessWorker = clientAllProcessWorkers[i],
      pId = +clientProcessWorker.process_id;
    clientAllWorkersMap[clientProcessWorker.client_id] = clientAllWorkersMap[clientProcessWorker.client_id] || [];

    if (pId && pId !== processId) {
      clientAllWorkersMap[clientProcessWorker.client_id].push(pId);
    }
  }

  for (let i = 0; i < processWorkers.length; i++) {
    let clientId = processWorkers[i].client_id;
    if (clientAllWorkersMap[clientId].length > 0) {
      logger.step('Starting disassociation of client: ' + clientId);
      let obj = new disAssociateWorkerKlass({ clientId: clientId, processIds: [processId] });
      await obj.perform();
      await basicHelper.pauseForMilliSeconds(1000);
    } else {
      cannotDisassociateClient.push(clientId);
    }
  }

  if (cannotDisassociateClient.length > 0) {
    logger.step(
      'Some of the clients cannot be disassociated as those clients do not have any other process associated with them. ' +
        'These clients are: ',
      cannotDisassociateClient
    );
    process.exit(1);
  } else {
    await new ProcessQueueAssociationModel()
      .update({ status: new ProcessQueueAssociationModel().invertedStatuses[processQueueAssocConst.processKilled] })
      .where({ process_id: processId })
      .fire();

    logger.step(
      'Please terminate process only after the respective queue is empty and no client is associated with it.'
    );
  }
  process.exit(0);
};

run();
