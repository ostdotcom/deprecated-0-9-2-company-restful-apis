'use strict';

const rootPrefix = '../..'
  , ddbServiceObj = require(rootPrefix + '/lib/dynamoDB_service')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , commonValidator = require(rootPrefix +  '/lib/validators/common')
;

/**
 * AssignShards
 * @param params
 * @param <Integer> - client_id
 * @constructor
 */
const AssignShards = function (params) {
  const oThis = this
  ;

  oThis.clientId = params.client_id;
};

AssignShards.prototype = {

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
            internal_error_identifier: 'l_ob_as_1',
            api_error_identifier: 'unhandled_catch_response',
            debug_options: {}
          });
        }
      });
  },

  /**
   * asyncPerform
   *
   * @return {promise}
   */
  asyncPerform: async function () {
    const oThis = this
    ;

    await oThis.validateAndSanitize();

    await new ddbServiceObj.BalanceModel({
      client_id: oThis.clientId,
      ddb_service: ddbServiceObj,
      auto_scaling: ''
    }).allocate();

    await new ddbServiceObj.TransactionTypeModel({
      client_id: oThis.clientId,
      ddb_object: ddbServiceObj,
      auto_scaling: ''
    }).allocate();

  },

  /**
   * validateAndSanitize
   *
   * @return {promise}
   */
  validateAndSanitize: async function () {
    const oThis = this
    ;

    if (commonValidator.isVarNull(oThis.clientId)) {

      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 'l_ob_as_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['missing_client_id'],
        debug_options: {}
      }));
    }

    return Promise.resolve({});
  }

};