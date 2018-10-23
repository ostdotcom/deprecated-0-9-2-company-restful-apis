'use strict';
/**
 * This script will remove the existing geth providers.
 * Final result will contain following keys only -
 * 1. read_only
 * 2. read_write
 * 3. OST_UTILITY_CHAIN_ID
 *
 * Usage: node executables/one_timers/remove_old_utility_geth_config.js
 *
 * @module executables/one_timers/remove_old_utility_geth_config
 */

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger.js'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id');

/**
 *
 * @constructor
 */
const RemoveOldUtilityGethProviers = function() {
  const oThis = this;
};

RemoveOldUtilityGethProviers.prototype = {
  /**
   *
   * Perform
   *
   * @return {promise}
   */
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'e_ot_uugic_1',
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
    const oThis = this;

    let strategyKindInt = configStrategyConstants.invertedKinds['utility_geth'],
      whereClause = ['kind = ?', strategyKindInt],
      configStrategyModelObj = new ConfigStrategyModel(),
      strategyIdResponse = await configStrategyModelObj
        .select()
        .where(whereClause)
        .fire();

    let strategyIdsArray = [],
      groupIdsArray = [];

    for (let index in strategyIdResponse) {
      strategyIdsArray.push(strategyIdResponse[index].id);
      groupIdsArray.push(strategyIdResponse[index].group_id);
    }

    let oldHash = {};

    for (let i = 0; i < groupIdsArray.length; i++) {
      let currentGroupId = groupIdsArray[i],
        strategyId = strategyIdsArray[i],
        strategyByGroupHelperObj = new StrategyByGroupHelper(currentGroupId),
        getForKindResponse = await strategyByGroupHelperObj.getForKind('utility_geth');

      let oldData = getForKindResponse.data,
        keyInOldData = Object.keys(oldData),
        oldConfigHash = oldData[keyInOldData];

      console.log('old utility config=======>', oldData);

      if (oldConfigHash['read_only'] !== undefined || oldConfigHash['read_write'] !== undefined) {
        delete oldConfigHash['OST_UTILITY_GETH_RPC_PROVIDER'];
        delete oldConfigHash['OST_UTILITY_GETH_RPC_PROVIDERS'];
        delete oldConfigHash['OST_UTILITY_GETH_WS_PROVIDER'];
        delete oldConfigHash['OST_UTILITY_GETH_WS_PROVIDERS'];

        let configStrategyModelObj = new ConfigStrategyModel(),
          updateResponse = await configStrategyModelObj.updateStrategyId(strategyId, oldConfigHash);

        logger.log('Updated utility geth config for Config Strategy id:' + strategyId);

        if (!updateResponse) {
          logger.error('Error in updating utility geth hash: ', updateResponse);
          return Promise.reject(
            responseHelper.error({
              internal_error_identifier: 'e_ot_rougc_1',
              api_error_identifier: 'something_went_wrong',
              debug_options: {}
            })
          );
        }
      } else {
        logger.error('read_only/read_only geths not present for strategy id:' + strategyId);
      }
    }
  }
};

// perform action
const removeOldUtilityGethProviersObj = new RemoveOldUtilityGethProviers();
removeOldUtilityGethProviersObj.perform().then(async function(a) {
  console.log('====Script Finished====');
  process.exit(0);
});
