"use strict";

var rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , clientAirdropModel = require(rootPrefix + '/app/models/client_airdrop')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  ;


/**
 * Fetch status of Airdrop initiated
 *
 * @module services/airdrop_management/get_airdrop_status
 */
const GetAirdropStatusKlass = function(params){
  const oThis = this;

  oThis.airdropUuid = params.airdrop_uuid;
  oThis.clientId = params.client_id;

};

/**
 * Fetch Status of given Airdrop UUID
 *
 * @param {object} params - this is object with keys.
 *                  airdrop_uuid - Airdrop uuid to fetch data for.
 *                  client_id - Client Id to check whom airdrop request belongs.
 *
 * @constructor
 */
GetAirdropStatusKlass.prototype = {

  perform: function(){
    const oThis = this;

    return oThis.asyncPerform()
      .catch(function(error) {
        if (responseHelper.isCustomResult(error)){
          return error;
        } else {
          logger.error(`${__filename}::perform::catch`);
          logger.error(error);

          return responseHelper.error("s_am_gas_3", "Unhandled result", null, {}, {});
        }
      });
  },

  asyncPerform: async function(){
    const oThis = this;

    var obj = new clientAirdropModel();
    var response = await obj.getByUuid(oThis.airdropUuid);
    if(response[0]){
      var record = response[0];
      if(record.client_id != oThis.clientId){
        return Promise.resolve(responseHelper.error("s_am_gas_2", "Invalid Airdrop Request Id."));
      }
      var current_status = 'pending';
      if(record.status == obj.invertedStatuses[clientAirdropConst.completeStatus]){
        current_status = 'complete';
      } else if(record.status == obj.invertedStatuses[clientAirdropConst.failedStatus]){
        current_status = 'failed';
      }
      return Promise.resolve(responseHelper.successWithData({airdrop_uuid: oThis.airdropUuid,
        current_status: current_status, steps_complete: obj.getAllBits('steps_complete', record.steps_complete)}));
    } else {
      return Promise.resolve(responseHelper.error("s_am_gas_1", "Invalid Airdrop Request Id."));
    }
  }

};

module.exports = GetAirdropStatusKlass;