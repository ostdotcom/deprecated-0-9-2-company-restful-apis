"use strict";

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , ClientAirdropModel = require(rootPrefix + '/app/models/client_airdrop')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , AirdropEntityFormatterKlass = require(rootPrefix + '/lib/formatter/entities/latest/airdrop')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/**
 * Fetch status of Airdrop initiated
 *
 * @param {object} params - external passed parameters
 * @param {number} params.client_id (Mandatory) - client id
 * @param {string} params.airdrop_uuid (Mandatory) - uuid of the airdrop for which status get.
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

          return responseHelper.error({
            internal_error_identifier: 's_am_gas_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  asyncPerform: async function(){
    const oThis = this
    ;

    var response = await new ClientAirdropModel().select('*').where(['airdrop_uuid=?', oThis.airdropUuid]).fire();
    if(response[0]){
      var record = response[0];
      if(record.client_id != oThis.clientId){
        return Promise.reject(responseHelper.error({
          internal_error_identifier: 's_am_gas_2',
          api_error_identifier: 'data_not_found',
          debug_options: {}
        }));
      }
      var current_status = 'pending';
      if(record.status == new ClientAirdropModel().invertedStatuses[clientAirdropConst.completeStatus]){
        current_status = 'complete';
      } else if(record.status == new ClientAirdropModel().invertedStatuses[clientAirdropConst.failedStatus]){
        current_status = 'failed';
      }

      const airdropEntityData = {
        id: oThis.airdropUuid,
        current_status: current_status,
        steps_complete: new ClientAirdropModel().getAllBits('steps_complete', record.steps_complete)
      };

      const airdropEntityFormatter = new AirdropEntityFormatterKlass(airdropEntityData)
        , airdropEntityFormatterRsp = await airdropEntityFormatter.perform()
      ;

      const apiResponseData = {
        result_type: 'airdrop',
        airdrop: airdropEntityFormatterRsp.data
      };

      return Promise.resolve(responseHelper.successWithData(apiResponseData));

    } else {
      return Promise.reject(responseHelper.error({
        internal_error_identifier: 's_am_gas_3',
        api_error_identifier: 'data_not_found',
        debug_options: {}
      }));
    }
  }

};

module.exports = GetAirdropStatusKlass;