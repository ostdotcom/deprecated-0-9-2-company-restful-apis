"use strict";

const rootPrefix = '../../..'
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
    , ManagedAddressKlass = require(rootPrefix + '/app/models/managed_address')
    , managedAddress = new ManagedAddressKlass()
;

/**
 * constructor
 *
 * @constructor
 */
const GetAddressesByUuidKlass = function (params) {

  const oThis = this;

  oThis.uuids = params.uuids;
  oThis.clientId = params.client_id;
  
};

GetAddressesByUuidKlass.prototype = {

  perform: function() {
    const oThis = this;

    return oThis.asyncPerform()
      .catch((error) => {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_cu_gabu_3", "Unhandled result", null, {}, {});
        }
      });
  },

  /**
   * fetch data
   *
   * @return {Promise<result>}
   */
  asyncPerform: async function () {
    
    const oThis = this;
    
    var usersData = await managedAddress.getByUuids(oThis.uuids);

    if (usersData.length <= 0) {
      return Promise.resolve(responseHelper.error("s_cu_gabu_1", "No Data found"));
    }
    
    var response = {};

    for (var i = 0; i < usersData.length; i++) {
      
      var user = usersData[i];

      if (user['client_id'] != oThis.clientId) {
        return Promise.resolve(responseHelper.error("s_cu_gabu_2", "Invalid client details."));
      }

      response[user['uuid']] = user['ethereum_address'];
      
    }

    return Promise.resolve(responseHelper.successWithData({user_addresses: response}));

  }

};

module.exports = GetAddressesByUuidKlass;