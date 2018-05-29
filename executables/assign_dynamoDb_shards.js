'use strict';

const rootPrefix = '..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , AssignShardsForClient = require(rootPrefix + '/lib/on_boarding/assign_shards')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , commonValidator = require(rootPrefix +  '/lib/validators/common')
;

/**
 *
 * @param params
 * @param<Integer> start_client_id
 * @constructor
 */
const AssignShards = function (params) {
  const oThis = this
  ;

  oThis.startClientId = params.start_client_id;
  oThis.endClientId = null;
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
            internal_error_identifier: 'e_ads_1',
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

    await oThis.validateAndSanitize();

    await oThis.fetchMaxClientId();

    await oThis.assignShards();

  },

  /**
   * validateAndSanitize
   *
   * @returns {promise}
   */

  validateAndSanitize: function () {
    const oThis = this
    ;

    if (commonValidator.isVarNull(oThis.startClientId)) {
      return Promise.reject(responseHelper.paramValidationError({
        internal_error_identifier: 'e_ads_2',
        api_error_identifier: 'invalid_api_params',
        params_error_identifiers: ['missing_start_client_id'],
        debug_options: {}
      }));
    }

    return Promise.resolve({});
  },

  /**
   * fetchMaxClientId - Fetch the max client id for assigning
   *
   * @returns {promise}
   */
  fetchMaxClientId: async function() {
    const oThis = this
    ;

    let query = await (new ClientBrandedTokenModel())
      .select(['client_id'])
      .where('client_id >= ?', parseInt(oThis.startClientId))
      .order_by('client_id DESC');

    let results = await query.fire();

    oThis.endClientId = results[0];

  },

  /**
   * assignShards - Call assign shard methods
   *
   * @returns {promise}
   */
  assignShards: async function () {
    const oThis = this
    ;

    let promiseArray = [];

    for (let id = oThis.startClientId; id <= oThis.endClientId; id = id + 10) {
      let endId = id + 10;

      for (let client_id = id; client_id < endId && client_id < oThis.endClientId; client_id++ ) {
        promiseArray.push(new AssignShardsForClient({
          client_id: client_id
        }).perform());
      }

      await Promise.all(promiseArray);

      promiseArray = [];
    }

    return Promise.resolve({});
  }

};
