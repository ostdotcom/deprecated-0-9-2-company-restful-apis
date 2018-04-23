"use strict";

const rootPrefix = '../../..'
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
    , ManagedAddressModel = require(rootPrefix + '/app/models/managed_address')
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
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_cu_gabu_3", "Unhandled result", {}, {sendErrorEmail: false});
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
    
    var usersData = await new ManagedAddressModel().getByUuids(oThis.uuids);

    if (usersData.length <= 0) {
      return Promise.resolve(responseHelper.error("s_cu_gabu_1", "No Data found", {}, {sendErrorEmail: false}));
    }
    
    var response = {};

    for (var i = 0; i < usersData.length; i++) {
      
      var user = usersData[i];

      if (user['client_id'] != oThis.clientId) {
        return Promise.resolve(responseHelper.error("s_cu_gabu_2", "Invalid client details.", {},
          {sendErrorEmail: false}));
      }

      response[user['uuid']] = user['ethereum_address'];
      
    }

    return Promise.resolve(responseHelper.successWithData({user_addresses: response}));

  }

};

module.exports = GetAddressesByUuidKlass;