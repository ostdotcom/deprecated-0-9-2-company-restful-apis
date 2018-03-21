"use strict";

const rootPrefix = ".."
  , clientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , clientWorkerAddressModel = require(rootPrefix + '/app/models/client_worker_managed_address_id')
  , clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id')
  ;

const PopulateClientAddresses = function(){};

PopulateClientAddresses.prototype = {

  perform: async function(){

    var response = await new clientBrandedTokenModel().select('id, client_id, worker_managed_address_id').where(["id > ?", 0]).fire();
    if(response.length > 0){
      var managedAddressInsertData = [];
      var clientWorkerAddrObj = new clientWorkerAddressModel();
      for (var i = 0; i < response.length; i++) {
        var row = response[i];
        const sql_rows = [row.client_id, row.worker_managed_address_id,
          clientWorkerAddrObj.invertedStatuses[clientWorkerManagedAddressConst.activeStatus]];
        managedAddressInsertData.push(sql_rows);
      }
      if(managedAddressInsertData.length === response.length){
        var fields = ['client_id', 'managed_address_id', 'status'];
        const queryResponse = await clientWorkerAddrObj.bulkInsert(fields, managedAddressInsertData);
        return Promise.resolve("Done");
      }
    }

    return Promise.resolve("Data not moved");

  }

};

const populateData = new PopulateClientAddresses();
populateData.perform().then(console.log);