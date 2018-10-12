'use strict';

/**
 * OpenStPlatform Provider
 *
 * @module lib/providers/platform
 */

const OSTPlatform = require('@openstfoundation/openst-platform');

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ConnectionTimeoutConst = require(rootPrefix + '/lib/global_constant/connection_timeout');

/**
 * Constructor
 *
 * @constructor
 */
const PlatformProviderKlass = function(configStrategy, instanceComposer) {};

PlatformProviderKlass.prototype = {
  /**
   * get provider
   *
   * @return {object}
   */
  getInstance: function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    // Updating configStrategy for openst-notification.
    configStrategy.OST_RMQ_USERNAME = coreConstants.OST_RMQ_USERNAME;
    configStrategy.OST_RMQ_PASSWORD = coreConstants.OST_RMQ_PASSWORD;
    configStrategy.OST_RMQ_HOST = coreConstants.OST_RMQ_HOST;
    configStrategy.OST_RMQ_PORT = coreConstants.OST_RMQ_PORT;
    configStrategy.OST_RMQ_HEARTBEATS = coreConstants.OST_RMQ_HEARTBEATS;
    configStrategy.OST_RMQ_SUPPORT = coreConstants.OST_RMQ_SUPPORT;
    configStrategy.CONNECTION_WAIT_SECONDS = ConnectionTimeoutConst.appServer;

    return new OSTPlatform(configStrategy);
  }
};

InstanceComposer.register(PlatformProviderKlass, 'getPlatformProvider', true);

module.exports = PlatformProviderKlass;
