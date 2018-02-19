"use strict";

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix+'/lib/logger/custom_console_logger')
  , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , managedAddress = new ManagedAddressKlass()
;

/**
 * constructor
 *
 * @constructor
 */
const GetUsersDataKlass = function(params) {

  const oThis = this;

  oThis.ethAddresses = params.ethereum_addresses;
  oThis.clientId = params.client_id;
};

GetUsersDataKlass.prototype = {

  /**
   * fetch data
   *
   * @return {Promise<result>}
   */
  perform: async function(){
    const oThis = this;
    var users = await managedAddress.getByEthAddresses(oThis.ethAddresses);

    if(users.length <= 0){
      return Promise.resolve(responseHelper.error("s_cu_gud_1", "No Data found"));
    }

    var response = {};
    for(var i=0;i<users.length;i++){
      var user = users[i];

      if(user['client_id'] != oThis.clientId){
        return Promise.resolve(responseHelper.error("s_cu_gud_2", "Invalid client details."));
      }

      response[user['ethereum_address']] = user;
    }

    return responseHelper.successWithData(response);
  }

};

module.exports = GetUsersDataKlass;