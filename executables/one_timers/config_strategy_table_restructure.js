'use strict';

/*
* This script is used to segregate config strategies into encrypted_params and unencrypted_params.
*
* Usage:  node executables/one_timers/config_strategy_table_restructure.js
*
*
* */

const rootPrefix = '../..',
  configStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

const configStrategiesRestructure = function() {};

configStrategiesRestructure.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      logger.error(error);
      process.exit(1);
    });
  },

  asyncPerform: async function() {
    const oThis = this;

    await oThis.restructure_strategy();
    logger.log('Success');
    process.exit(0);
  },

  restructure_strategy: async function() {
    const oThis = this;

    let configStrategies = await new configStrategyModel().select('*').fire();

    for (let index in configStrategies) {
      const dataHash = configStrategies[index];

      let kindName = configStrategyConstants.kinds[String(dataHash.kind)],
        existingStrategyId = dataHash.id,
        existingStrategyParams = await new configStrategyModel().getByIds([existingStrategyId]), //This will give decrypted params.
        existingParamsHash = {};

      existingParamsHash = existingStrategyParams[existingStrategyId][kindName];

      await new configStrategyModel().updateStrategyId(existingStrategyId, existingParamsHash).then();
    }
  }
};

new configStrategiesRestructure().perform().then();
