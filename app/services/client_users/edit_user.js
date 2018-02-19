"use strict";

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , managedAddressObj = new ManagedAddressKlass()
;

const editUser = {

  perform: async function(clientId, userUuid, name){

    const oThis = this;

    if(!clientId || !userUuid || !name){
      return responseHelper.error("s_cu_eu_1", "Mandatory parameters missing");
    }

    var managedAddressCache = new ManagedAddressCacheKlass({'uuids': [userUuid] });

    const cacheFetchResponse = await managedAddressCache.fetch();
    var response = cacheFetchResponse.data[userUuid];

    if (cacheFetchResponse.isFailure() || !response) {
      return responseHelper.error("s_cu_eu_2", "User not found");
    }

    if (response['client_id'] != clientId){
      return responseHelper.error("s_cu_eu_3", "User does not belong to client");
    }

    if(response['name'] == name){
      return responseHelper.successWithData({});
    }

    var updateQueryResponse = managedAddressObj.edit({
      qParams: {
        name: name
      },
      whereCondition: {
        uuid: userUuid
      }
    });
    managedAddressCache.clear();

    return responseHelper.successWithData({});

  }

};

module.exports = editUser;