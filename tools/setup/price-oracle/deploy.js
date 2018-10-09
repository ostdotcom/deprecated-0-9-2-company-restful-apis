'use strict';

/**
 * Deploy Price Oracle contract for OST and USD
 *
 *
 * @module tools/setup/price-oracle/deploy
 */

const rootPrefix = '../../..';
require(rootPrefix + '/module_overrides/index');

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

require(rootPrefix + '/lib/providers/price_oracle');

const args = process.argv,
  group_id = args[2];

/**
 * Deploy Price Oracle contract for OST and USD
 *
 * @constructor
 */
const DeployPriceOracleKlass = function() {};

DeployPriceOracleKlass.prototype = {
  /**
   * Perform method to deploy price oracle contract.
   *
   * @return {Promise<void>}
   */
  perform: async function() {
    const oThis = this,
      strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(),
      configStrategy = configStrategyResp.data;

    let instanceComposer = new InstanceComposer(configStrategy),
      DeployAndSetOpsKlass = instanceComposer.getPriceOracleProvider().getInstance().deployAndSetOps;

    const deployerObj = new DeployAndSetOpsKlass();
    var resp = await deployerObj.perform({
      gasPrice: configStrategy.OST_UTILITY_GAS_PRICE,
      baseCurrency: 'OST',
      quoteCurrency: 'USD'
    });

    logger.debug(' ********* Response *****');
    logger.debug(resp);

    process.exit(0);
  }
};

const deployPriceOracle = new DeployPriceOracleKlass();
deployPriceOracle.perform();
