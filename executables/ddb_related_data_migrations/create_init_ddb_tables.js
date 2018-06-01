'use strict';

const OSTStorage = require('@openstfoundation/openst-storage')
;

const rootPrefix = '../..'
    , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
    , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
    , shardMgmtObj = ddbServiceObj.shardManagement()
    , autoscalingServiceObj = require(rootPrefix + '/lib/auto_scaling_service')
;

/**
 *
 * @param params
 *
 * @constructor
 *
 */
const CreateInitDdbTables = function (params) {

  const oThis = this
  ;

};

CreateInitDdbTables.prototype = {

  /**
   * Perform
   *
   * @return {promise}
   */
  perform: function () {
    const oThis = this
    ;

    return oThis.asyncPerform()
        .catch(function (error) {
          if (responseHelper.isCustomResult(error)) {
            return error;
          } else {
            logger.error(`${__filename}::perform::catch`);
            logger.error(error);
            return responseHelper.error({
              internal_error_identifier: 'e_drdm_cs_1',
              api_error_identifier: 'unhandled_catch_response',
              debug_options: {}
            });
          }
        });
  },

  /**
   * asyncPerform - Perform asynchronously
   *
   * @returns {promise}
   */
  asyncPerform: async function() {

    const oThis = this
    ;

    await shardMgmtObj.runShardMigration(ddbServiceObj, autoscalingServiceObj);

    return Promise.resolve(responseHelper.successWithData({}));

  }

};

const object = new CreateInitDdbTables({});
object.perform().then(console.log);