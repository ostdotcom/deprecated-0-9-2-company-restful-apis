'use strict';

const rootPrefix = '../..',
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id');

const SetInitialGasTransferProperty = function() {};

SetInitialGasTransferProperty.prototype = {
  perform: async function() {
    const clientWorkerManagedAddressIdModelObject = new ClientWorkerManagedAddressIdModel(),
      initialGasTransferProperty =
        clientWorkerManagedAddressIdModelObject.invertedProperties[
          clientWorkerManagedAddressConst.initialGasTransferredProperty
        ],
      countRowsResponse = await new ClientWorkerManagedAddressIdModel().select('count(*) as cnt').fire(),
      rows = countRowsResponse[0].cnt;

    await new ClientWorkerManagedAddressIdModel()
      .update(['properties = properties | ?', initialGasTransferProperty])
      .where(['id >= ? AND id <= ? ', '1', rows])
      .fire();
  }
};

const populateData = new SetInitialGasTransferProperty();
populateData.perform().then(function() {
  console.log('==============DONE=============');
  process.exit(1);
});
