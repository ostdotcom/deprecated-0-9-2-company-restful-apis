'use strict';
/**
 * This script will add read-write and read-only hash to existing utility geth hash.
 * Final result will contain following keys -
 * 1. OST_UTILITY_GETH_RPC_PROVIDER
 * 2. OST_UTILITY_GETH_RPC_PROVIDERS
 * 3. OST_UTILITY_GETH_WS_PROVIDER
 * 4. OST_UTILITY_GETH_WS_PROVIDERS
 * 5. read_only
 * 6. read_write
 * 7. OST_UTILITY_CHAIN_ID
 *
 * Usage: node executables/one_timers/update_utility_geth_in_config.js
 *
 * @module executables/one_timers/update_utility_geth_in_config
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
const UpdateUtilityGethProviers = function() {
  const oThis = this;
};

UpdateUtilityGethProviers.prototype = {
  /**
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

    console.log('strategyIdsArray=====>', strategyIdsArray, '\n====groupIdsArray====>', groupIdsArray);

    let oldHash = {};

    for (let i = 0; i < groupIdsArray.length; i++) {
      let currentGroupId = groupIdsArray[i],
        strategyId = strategyIdsArray[i],
        strategyByGroupHelperObj = new StrategyByGroupHelper(currentGroupId),
        getForKindResponse = await strategyByGroupHelperObj.getForKind('utility_geth');

      let oldData = getForKindResponse.data,
        keyInOldData = Object.keys(oldData),
        oldConfigHash = oldData[keyInOldData];

      //console.log('oldHash=======>',oldConfigHash);

      let read_only = {},
        read_write = {};

      let newHashToBeInserted = Object.assign({}, oldConfigHash);

      let tempConfigHash = oldConfigHash;
      delete tempConfigHash['OST_UTILITY_CHAIN_ID'];

      read_only = Object.assign({}, tempConfigHash);
      read_write = Object.assign({}, tempConfigHash);

      newHashToBeInserted['read_only'] = read_only;
      newHashToBeInserted['read_write'] = read_write;

      if (oldConfigHash['read_only'] === undefined || oldConfigHash['read_write'] === undefined) {
        let configStrategyModelObj = new ConfigStrategyModel(),
          updateResponse = await configStrategyModelObj.updateStrategyId(strategyId, newHashToBeInserted);

        logger.log('Updated utility geth config for Config Strategy id:' + strategyId);

        if (!updateResponse) {
          logger.error('Error in updating utility geth hash: ', updateResponse);
          return Promise.reject(
            responseHelper.error({
              internal_error_identifier: 'e_ot_uugic_1',
              api_error_identifier: 'something_went_wrong',
              debug_options: {}
            })
          );
        }
      } else {
        logger.error('read_only/read_only geths already present for strategy id:' + strategyId);
      }
    }
  }
};

// perform action
const updateUtilityGethProviersObj = new UpdateUtilityGethProviers();
updateUtilityGethProviersObj.perform().then(async function(a) {
  console.log('====Script Finished====');
  process.exit(0);
});
