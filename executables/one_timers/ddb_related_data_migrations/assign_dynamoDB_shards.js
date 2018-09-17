// 'use strict';
//
// const rootPrefix = '../..',
//   logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
//   responseHelper = require(rootPrefix + '/lib/formatter/response'),
//   InstanceComposer = require(rootPrefix + '/instance_composer'),
//   ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
//   commonValidator = require(rootPrefix + '/lib/validators/common'),
//   basicHelper = require(rootPrefix + '/helpers/basic'),
//   ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy'),
//   configStrategyHelper = new ConfigStrategyHelperKlass(),
//   apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
//   errorConfig = basicHelper.fetchErrorConfig(apiVersions.internal);
//
// require(rootPrefix + '/lib/on_boarding/assign_shards');
//
// /**
//  *
//  * @param params
//  * @param<Integer> start_client_id
//  *
//  * @constructor
//  *
//  */
// const AssignShards = function(params) {
//   const oThis = this;
//
//   oThis.startClientId = params.start_client_id;
//   oThis.endClientId = null;
// };
//
// AssignShards.prototype = {
//   /**
//    * Perform
//    *
//    * @return {promise}
//    */
//   perform: function() {
//     const oThis = this;
//
//     return oThis.asyncPerform().catch(function(error) {
//       if (responseHelper.isCustomResult(error)) {
//         return error;
//       } else {
//         logger.error(`${__filename}::perform::catch`);
//         logger.error(error);
//         return responseHelper.error({
//           internal_error_identifier: 'e_drdm_ads_1',
//           api_error_identifier: 'unhandled_catch_response',
//           debug_options: {}
//         });
//       }
//     });
//   },
//
//   /**
//    * asyncPerform - Perform asynchronously
//    *
//    * @returns {promise}
//    */
//   asyncPerform: async function() {
//     const oThis = this;
//
//     await oThis._validateAndSanitize();
//
//     await oThis._fetchMaxClientId();
//
//     await oThis._assignShards();
//   },
//
//   /**
//    * validateAndSanitize
//    *
//    * @returns {promise}
//    */
//
//   _validateAndSanitize: function() {
//     const oThis = this;
//
//     if (!commonValidator.isVarInteger(oThis.startClientId)) {
//       return Promise.reject(
//         responseHelper.paramValidationError({
//           internal_error_identifier: 'e_drdm_ads_2',
//           api_error_identifier: 'invalid_api_params',
//           params_error_identifiers: ['invalid_start_client_id'],
//           error_config: errorConfig,
//           debug_options: {}
//         })
//       );
//     }
//
//     return Promise.resolve({});
//   },
//
//   /**
//    * fetchMaxClientId - Fetch the max client id for assigning
//    *
//    * @returns {promise}
//    */
//   _fetchMaxClientId: async function() {
//     const oThis = this;
//
//     let query = await new ClientBrandedTokenModel()
//       .select(['client_id'])
//       .where(['client_id >= ?', parseInt(oThis.startClientId)])
//       .limit(1)
//       .order_by('id DESC');
//
//     let results = await query.fire();
//
//     oThis.endClientId = results[0]['client_id'];
//   },
//
//   /**
//    * assignShards - Call assign shard methods
//    *
//    * @returns {promise}
//    */
//   _assignShards: async function() {
//     const oThis = this;
//
//     let promiseArray = [];
//
//     logger.info('oThis.startClientId', oThis.startClientId);
//     logger.info('oThis.endClientId', oThis.endClientId);
//
//     for (let id = oThis.startClientId; id <= oThis.endClientId; id = id + 10) {
//       let endId = id + 10,
//         index = 0,
//         indexToClientIdMap = {};
//
//       logger.info('starting for ids >= ', id, ' and < ', endId);
//
//       for (let client_id = id; client_id < endId && client_id < oThis.endClientId; client_id++) {
//         let configStrategyRsp = await configStrategyHelper.getConfigStrategy(client_id),
//           ic = new InstanceComposer(configStrategyRsp.data),
//           AssignShardsForClient = ic.getAssignShardsClass();
//
//         let promise = new AssignShardsForClient({
//           client_id: client_id
//         })
//           .perform()
//           .catch(oThis.catchHandlingFunction);
//
//         promiseArray.push(promise);
//
//         indexToClientIdMap[index] = client_id;
//         index += 1;
//       }
//
//       logger.info('waiting for completion for ids between ', id, ' and ', endId);
//
//       let promiseResponses = await Promise.all(promiseArray);
//
//       for (let i = 0; i < promiseResponses.length; i++) {
//         if (promiseResponses[i].isFailure()) {
//           logger.info('client_id failed: ', indexToClientIdMap[i], promiseResponses[i].toHash());
//         }
//       }
//
//       promiseArray = [];
//     }
//
//     return Promise.resolve({});
//   },
//
//   /**
//    * generic function to handle catch blocks
//    *
//    * @returns {object}
//    */
//   catchHandlingFunction: async function(error) {
//     if (responseHelper.isCustomResult(error)) {
//       return error;
//     } else {
//       logger.error(`${__filename}::perform::catch`);
//       logger.error(error);
//       return responseHelper.error({
//         internal_error_identifier: 'e_drdm_ads_1',
//         api_error_identifier: 'something_went_wrong',
//         debug_options: {},
//         error_config: errorConfig
//       });
//     }
//   }
// };
//
// const object = new AssignShards({ start_client_id: 1000 });
// object
//   .perform()
//   .then(function(a) {
//     console.log(a.toHash());
//     process.exit(0);
//   })
//   .catch(function(a) {
//     console.log(a);
//     process.exit(1);
//   });
