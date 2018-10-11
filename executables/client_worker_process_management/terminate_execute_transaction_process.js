'use strict';

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  deassociateWorkerKlass = require(rootPrefix + '/lib/execute_transaction_management/deassociate_worker');

const processId = argv[2];

const run = async function() {
  let processWorkers = await new ClientWorkerManagedAddressIdModel()
    .select('*')
    .where({ process_id: processId })
    .fire();
  let clientIds = [],
    clientAllWorkersMap = {},
    canNotDeassociateClient = [];

  for (var i = 0; i < processWorkers.length; i++) {
    clientIds.push(processWorkers[i].client_id);
  }

  let clientAllProcessWorkers = await new ClientWorkerManagedAddressIdModel()
    .select('*')
    .where('client_id in (?)', clientIds)
    .fire();

  for (var i = 0; i < clientAllProcessWorkers.length; i++) {
    let clientProcessWorker = clientAllProcessWorkers[i];
    clientAllWorkersMap[clientProcessWorker.clientId] = clientAllWorkersMap[clientProcessWorker.clientId] || [];

    if (clientProcessWorker.process_id != processId) {
      clientAllWorkersMap[clientProcessWorker.clientId].push(clientProcessWorker.process_id);
    }
  }

  for (var i = 0; i < processWorkers.length; i++) {
    let clientId = processWorkers[i].client_id;
    if (clientAllWorkersMap[clientId].length > 0) {
      logger.info('starting deassociation of client' + clientId);
      let obj = new deassociateWorkerKlass({ clientId: clientId, processIds: [processId] });
      await obj.perform();
      await basicHelper.pauseForMilliSeconds(1000);
    } else {
      canNotDeassociateClient.push(clientId);
    }
  }

  if (canNotDeassociateClient.length > 0) {
    logger.info(
      'Some of clients can not deassociate due to not associated to any other process. List of clients is: ',
      canNotDeassociateClient
    );
  } else {
    logger.info('Please terminate Process only after the respective queue is empty and no client associated it');
  }
  exit(0);
};

run();
