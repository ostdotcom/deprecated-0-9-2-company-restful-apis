'use strict';

/**
 * OpenStPayments Provider
 *
 * @module lib/providers/payments
 */

const OSTPayments = require('@openstfoundation/openst-payments');

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ConnectionTimeoutConst = require(rootPrefix + '/lib/global_constant/connection_timeout');

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

    // Updating configStrategy for openst-notification.
    configStrategy.OST_RMQ_USERNAME = configStrategy.OST_SHARED_RMQ_USERNAME;
    configStrategy.OST_RMQ_PASSWORD = configStrategy.OST_SHARED_RMQ_PASSWORD;
    configStrategy.OST_RMQ_HOST = configStrategy.OST_SHARED_RMQ_HOST;
    configStrategy.OST_RMQ_PORT = configStrategy.OST_SHARED_RMQ_PORT;
    configStrategy.OST_RMQ_HEARTBEATS = configStrategy.OST_SHARED_RMQ_HEARTBEATS;
    configStrategy.OST_RMQ_CLUSTER_NODES = configStrategy.OST_SHARED_RMQ_CLUSTER_NODES;
    configStrategy.OST_RMQ_SUPPORT = coreConstants.OST_RMQ_SUPPORT;
    configStrategy.CONNECTION_WAIT_SECONDS = ConnectionTimeoutConst.appServer;
    configStrategy.SWITCH_HOST_AFTER_TIME = ConnectionTimeoutConst.switchConnectionAppServer;

    return new OSTPayments(configStrategy);
  }
};

InstanceComposer.register(PaymentsProviderKlass, 'getPaymentsProvider', true);

module.exports = PaymentsProviderKlass;
