'use strict';

const rootPrefix = '..',
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  chainInteractionConstants = require(rootPrefix + '/config/chain_interaction_constants'),
  OpenSTPayment = require('@openstfoundation/openst-payments'),
  Workers = OpenSTPayment.services.workers;

const FixStatusKlass = function() {};

FixStatusKlass.prototype = {
  perform: async function() {
    const oThis = this,
      pageLimit = 100,
      workersContractAddress = chainInteractionConstants.UTILITY_WORKERS_CONTRACT_ADDRESS,
      utilityChainId = chainInteractionConstants.UTILITY_CHAIN_ID,
      inactiveStatus = new ClientWorkerManagedAddressIdModel().invertedStatuses[
        clientWorkerManagedAddressConst.inactiveStatus
      ];

    var startId = 0;
    var failedIdsData = {};

    while (true) {
      var managedAddressIdDataMap = {};

      var dbRows = await new ClientWorkerManagedAddressIdModel()
        .select('id, managed_address_id, status')
        .where(['id >= ?', startId])
        .limit(pageLimit)
        .fire();

      if (dbRows.length == 0) {
        return Promise.resolve('Done');
      }

      for (var i = 0; i < dbRows.length; i++) {
        var dbRow = dbRows[i];
        if (dbRow.status == inactiveStatus) {
          console.log('ignoring id: ', dbRow.id);
          continue;
        }
        managedAddressIdDataMap[parseInt(dbRow.managed_address_id)] = {
          idToUpdate: parseInt(dbRow.id)
        };
      }

      // console.log('managedAddressIdDataMap', managedAddressIdDataMap);

      startId = parseInt(dbRows[dbRows.length - 1].id) + 1;

      if (Object.keys(managedAddressIdDataMap).length == 0) {
        continue;
      }

      var managedAddressRows = await new ManagedAddressModel()
        .select('id, ethereum_address')
        .where(['id in (?)', Object.keys(managedAddressIdDataMap)])
        .fire();

      var idsToUpdate = [];

      for (var i = 0; i < managedAddressRows.length; i++) {
        var managedAddressRow = managedAddressRows[i];
        var idToUpdate = managedAddressIdDataMap[parseInt(managedAddressRow.id)]['idToUpdate'];
        var isWorkerObject = new Workers.isWorker({
          workers_contract_address: workersContractAddress,
          worker_address: managedAddressRow.ethereum_address,
          chain_id: utilityChainId
        });
        var rsp = await isWorkerObject.perform();
        if (rsp.isFailure()) {
          failedIdsData[idToUpdate] = rsp.toHash();
        }
        // console.log(rsp);
        if (!rsp.data.isValid) {
          console.error(
            'problem with: ethereum_address: ',
            managedAddressRow.ethereum_address,
            ' idToUpdate: ',
            idToUpdate
          );
          idsToUpdate.push(idToUpdate);
        }
      }

      if (idsToUpdate.length > 0) {
        console.log('idsToUpdate', idsToUpdate);
        // await new ClientWorkerManagedAddressIdModel().markStatusInActive(idsToUpdate);
      }
    }
  }
};

const populateData = new FixStatusKlass();
populateData.perform().then(console.log);
