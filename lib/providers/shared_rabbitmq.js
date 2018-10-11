'use strict';

/**
 * RabbitMQ instance provider which is not client specific.
 *
 * @module lib/providers/shared_rabbitmq
 */

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  OpenStNotification = require('@openstfoundation/openst-notification');

/**
 * Constructor
 *
 * @constructor
 */
const SharedRabbitMqProviderKlass = function() {};

SharedRabbitMqProviderKlass.prototype = {
  /**
   * Get provider
   *
   * @return {object}
   */
  getInstance: function(params) {
    const notificationConfigStrategy = {
      OST_RMQ_USERNAME: coreConstants.OST_RMQ_USERNAME,
      OST_RMQ_PASSWORD: coreConstants.OST_RMQ_PASSWORD,
      OST_RMQ_HOST: coreConstants.OST_RMQ_HOST,
      OST_RMQ_PORT: coreConstants.OST_RMQ_PORT,
      OST_RMQ_HEARTBEATS: coreConstants.OST_RMQ_HEARTBEATS,
      OST_RMQ_SUPPORT: coreConstants.OST_RMQ_SUPPORT
    };
    if (params) {
      Object.assign(notificationConfigStrategy, { CONNECTION_WAIT_SECONDS: params.connectionWaitSeconds });
    }

    return OpenStNotification.getInstance(notificationConfigStrategy);
  }
};

module.exports = new SharedRabbitMqProviderKlass();
