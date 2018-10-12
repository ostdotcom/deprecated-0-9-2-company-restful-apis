'use strict';

/**
 * OpenStNotification Provider
 *
 * @module lib/providers/notification
 */

const OpenStNotification = require('@openstfoundation/openst-notification');

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id');

/**
 * Constructor
 *
 * @constructor
 */
const NotificationProviderKlass = function(configStrategy, instanceComposer) {};

NotificationProviderKlass.prototype = {
  /**
   * get provider
   *
   * @return {object}
   */
  getInstance: function(params) {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    Object.assign(configStrategy, { OST_RMQ_SUPPORT: coreConstants.OST_RMQ_SUPPORT });
    if (params) {
      Object.assign(configStrategy, { CONNECTION_WAIT_SECONDS: params.connectionWaitSeconds });
    }
    return OpenStNotification.getInstance(configStrategy);
  },

  warmUpConnections: async function(params) {
    const strategyByGroupHelperObj = new StrategyByGroupHelper();
    let configStrategyResp = await strategyByGroupHelperObj.getActiveByKind('rmq').catch(function(err) {
      logger.error('Config strategy for rmq does not exist', err);
    });

    const configStrategyMap = configStrategyResp.data;

    configStrategyMap['sharedConfig'] = {
      OST_RMQ_USERNAME: coreConstants.OST_RMQ_USERNAME,
      OST_RMQ_PASSWORD: coreConstants.OST_RMQ_PASSWORD,
      OST_RMQ_HOST: coreConstants.OST_RMQ_HOST,
      OST_RMQ_PORT: coreConstants.OST_RMQ_PORT,
      OST_RMQ_HEARTBEATS: coreConstants.OST_RMQ_HEARTBEATS
    };

    for (let eachConfig in configStrategyMap) {
      let configStrategy = configStrategyMap[eachConfig];
      Object.assign(configStrategy, { OST_RMQ_SUPPORT: coreConstants.OST_RMQ_SUPPORT });
      if (params) {
        Object.assign(configStrategy, { connectionWaitSeconds: params.connectionWaitSeconds });
      }
      OpenStNotification.getInstance(configStrategy);
    }
  }
};

InstanceComposer.register(NotificationProviderKlass, 'getNotificationProvider', true);
let notificationProviderObj = new NotificationProviderKlass();
notificationProviderObj.warmUpConnections();

module.exports = NotificationProviderKlass;
