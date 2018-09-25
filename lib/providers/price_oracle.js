'use strict';

/**
 * OpenStStorage Provider
 *
 * @module lib/providers/price_oracle
 */

const OSTPriceOracle = require('@ostdotcom/ost-price-oracle');

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * Constructor
 *
 * @constructor
 */
const PriceOracleProviderKlass = function(configStrategy, instanceComposer) {};

PriceOracleProviderKlass.prototype = {
  /**
   * get provider
   *
   * @return {object}
   */
  getInstance: function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;
    return new OSTPriceOracle(configStrategy);
  }
};

InstanceComposer.register(PriceOracleProviderKlass, 'getPriceOracleProvider', true);

module.exports = PriceOracleProviderKlass;
