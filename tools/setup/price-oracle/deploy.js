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
  InstanceComposer = require(rootPrefix + '/instance_composer');

const args = process.argv,
  configStrategyFilePath = args[2],
  configStrategy = require(configStrategyFilePath),
  instanceComposer = new InstanceComposer(configStrategy),
  DeployAndSetOpsKlass = instanceComposer.getPriceOracleProvider().getInstance().deployAndSetOps;
require(rootPrefix + '/lib/providers/price_oracle');

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
    const deployerObj = new DeployAndSetOpsKlass();
    var resp = await deployerObj.perform({
      gasPrice: configStrategy.UTILITY_GAS_PRICE,
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
