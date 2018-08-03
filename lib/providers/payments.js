'use strict';

/**
 * OpenStPayments Provider
 *
 * @module lib/providers/payments
 */

const OSTPayments = require('@openstfoundation/openst-payments');

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * Constructor
 *
 * @constructor
 */
const PaymentsProviderKlass = function(configStrategy, instanceComposer) {};

PaymentsProviderKlass.prototype = {
  /**
   * get provider
   *
   * @return {object}
   */
  getInstance: function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;
    return new OSTPayments(configStrategy);
  }
};

InstanceComposer.register(PaymentsProviderKlass, 'getPaymentsProvider', true);

module.exports = PaymentsProviderKlass;
