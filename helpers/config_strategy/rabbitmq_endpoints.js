'use strict';

const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  ConfigStrategyModel = require(rootPrefix + '/app/models/config_strategy');

/**
 * group_id is optional
 * @param group_id
 * @constructor
 */
const SharedRabbitmqEnpoints = function() {};

SharedRabbitmqEnpoints.prototype = {
  get: async function() {
    const oThis = this,
      groupId = oThis.groupId;

    let strategyIdResponse = await new ConfigStrategyModel()
      .select(['id'])
      .where(['kind = ?', configStrategyConstants.invertedKinds[configStrategyConstants.shared_rmq]])
      .fire();

    if (!strategyIdResponse) {
      logger.error('Error in fetching strategy id of shared rabbitmq provider');
    }

    let sharedrmqstrategyid = strategyIdResponse[0].id,
      sharedrmqdata = await new ConfigStrategyModel().getByIds([sharedrmqstrategyid]);

    if (!sharedrmqdata) {
      logger.error('Error in fetching shared rabbitmq provider data');
    }

    let finalFlatHash = sharedrmqdata[sharedrmqstrategyid][configStrategyConstants.shared_rmq];

    return Promise.resolve(finalFlatHash);
  }
};

module.exports = SharedRabbitmqEnpoints;
