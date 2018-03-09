"use strict";

/**
 * Deploy Price Oracle contract for OST and USD
 *
 *
 * @module tools/setup/price-oracle/deploy
 */

const rootPrefix = "../../..";
require(rootPrefix + '/module_overrides/index');

const PriceOracleDeployerKlass = require(rootPrefix + '/node_modules/@ostdotcom/ost-price-oracle/tools/deploy/deploy_and_set_ops')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , chainConstants = require(rootPrefix + '/config/chain_interaction_constants')
  ;

/**
 * Deploy Price Oracle contract for OST and USD
 *
 * @constructor
 */
const DeployPriceOracleKlass = function(){};

DeployPriceOracleKlass.prototype = {

  /**
   * Perform method to deploy price oracle contract.
   *
   * @return {Promise<void>}
   */
  perform: async function(){

    const deployerObj = new PriceOracleDeployerKlass();
    var resp = await deployerObj.perform({gasPrice: chainConstants.UTILITY_GAS_PRICE,
      baseCurrency: "OST", quoteCurrency: "USD"});

    logger.info(" ********* Response *****");
    logger.info(resp);
    process.exit(0);

  }
};

const deployPriceOracle = new DeployPriceOracleKlass();
deployPriceOracle.perform();