"use strict";

const rootPrefix = ".."
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id')
  , clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id')
  , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , openStPlatform = require('@openstfoundation/openst-platform')
;

const PopulateClientAddresses = function () {};

PopulateClientAddresses.prototype = {

  perform: async function () {

    var response = await new ClientBrandedTokenModel().select('id, client_id, worker_managed_address_id')
      .where(["id > ?", 0]).fire();

    if (response.length == 0) {
      return Promise.resolve("nothing to move");
    }

    var managedAddressInsertData = []
      , workerManagedAddressIds = []
      , workerManagedAddrIdHasBalanceMap = {}
    ;

    for (var i = 0; i < response.length; i++) {
      workerManagedAddressIds.push(response[i].worker_managed_address_id);
    }

    const managedAddressRows = await new ManagedAddressModel().getByIds(workerManagedAddressIds);
    for (var i = 0; i < managedAddressRows.length; i++) {
      var buffer = managedAddressRows[i];
      var isBalanceAvailable = false;
      var obj = new openStPlatform.services.balance.simpleTokenPrime({'address': buffer.ethereum_address});
      var balanceAvailabilityRsp = await obj.perform();
      if (balanceAvailabilityRsp.isSuccess() && balanceAvailabilityRsp.data.balance > 0) {
        isBalanceAvailable = true;
      }
      workerManagedAddrIdHasBalanceMap[buffer.id] = isBalanceAvailable;
    }

    for (var i = 0; i < response.length; i++) {
      var row = response[i];
      const sql_row = [
        row.client_id, row.worker_managed_address_id,
        new ClientWorkerManagedAddressIdModel().invertedStatuses[clientWorkerManagedAddressConst.activeStatus],
        workerManagedAddrIdHasBalanceMap[row.worker_managed_address_id] ? 1 : 0
      ];
      managedAddressInsertData.push(sql_row);
    }

    if (managedAddressInsertData.length === response.length) {
      var fields = ['client_id', 'managed_address_id', 'status', 'properties'];
      const queryResponse = await (new ClientWorkerManagedAddressIdModel().insertMultiple(fields, managedAddressInsertData)).fire();
      return Promise.resolve("Done");
    }

  }

};

const populateData = new PopulateClientAddresses();
populateData.perform().then(logger.debug);