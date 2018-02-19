"use strict";

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_management/managedAddresses')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , managedAddressObj = new ManagedAddressKlass()
;

const editUser = {

  perform: async function(clientId, userUuid, name){

    const oThis = this;

    if(!clientId || !userUuid || !name){
      return responseHelper.error("s_cu_eu_1", "Mandatory parameters missing");
    }

    var managedAddressCache = new ManagedAddressCacheKlass({'addressUuid': userUuid });

    const cacheFetchResponse = await managedAddressCache.fetch();

    if (cacheFetchResponse.isFailure()) {
      return responseHelper.error("s_cu_eu_2", "User not found");
    }

    if (cacheFetchResponse.data['client_id'] != clientId){
      return responseHelper.error("s_cu_eu_3", "User does not belong to client");
    }

    if(cacheFetchResponse.data['name'] == name){
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