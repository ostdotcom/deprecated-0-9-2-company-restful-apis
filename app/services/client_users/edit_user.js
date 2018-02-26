"use strict";

/**
 * Edit Name of a user
 *
 * @module services/client_users/edit_user
 */
const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ManagedAddressCacheKlass = require(rootPrefix + '/lib/cache_multi_management/managedAddresses')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , managedAddressObj = new ManagedAddressKlass()
;

const editUser = {

  /**
   * Perform Edit user operation
   *
   * @param clientId
   * @param userUuid
   * @param name
   * @return {Promise<*>}
   */
  perform: async function (clientId, userUuid, name) {

    const oThis = this;

    if (!clientId || !userUuid || !name) {
      return responseHelper.error("s_cu_eu_1", "Mandatory parameters missing");
    }

    var managedAddressCache = new ManagedAddressCacheKlass({'uuids': [userUuid]});

    const cacheFetchResponse = await managedAddressCache.fetch();
    var response = cacheFetchResponse.data[userUuid];

    if (cacheFetchResponse.isFailure() || !response) {
      return responseHelper.error("s_cu_eu_2", "User not found");
    }

    if (response['client_id'] != clientId) {
      return responseHelper.error("s_cu_eu_3", "User does not belong to client");
    }

    var apiResponseData = {
      result_type: "economy_users",
      'economy_users': [
        {
          uuid: userUuid,
          name: name,
          total_airdropped_tokens: 0,
          token_balance: 0
        }
      ],
      meta: {
        next_page_payload: {}
      }
    };

    if (response['name'] == name) {
      return responseHelper.successWithData(apiResponseData);
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

    return responseHelper.successWithData(apiResponseData);

  }

};

module.exports = editUser;