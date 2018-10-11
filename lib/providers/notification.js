'use strict';

/**
 * OpenStNotification Provider
 *
 * @module lib/providers/notification
 */

const OpenStNotification = require('@openstfoundation/openst-notification');

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

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
  getInstance: async function(params) {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    if (params.connectionWaitSeconds) {
      Object.assign(configStrategy, { connectionWaitSeconds: params.connectionWaitSeconds });
    }
    return OpenStNotification.getInstance(configStrategy);
  },

  warmUpConnectionPool: async function(params) {
    const strategyByGroupHelperObj = new StrategyByGroupHelper();
    let configStrategyMap = {};
    await strategyByGroupHelperObj
      .getActiveByKind('rmq')
      .then(function(response) {
        configStrategyMap = response.data;
      })
      .catch(function(err) {
        logger.error('Config strategy for rmq does not exist', err);
      });

    for (let eachConfig in configStrategyMap) {
      let configStrategy = configStrategyMap[eachConfig];
      if (params.connectionWaitSeconds) {
        Object.assign(configStrategy, { connectionWaitSeconds: params.connectionWaitSeconds });
      }
      OpenStNotification.getInstance(configStrategy);
    }
  }
};

InstanceComposer.register(NotificationProviderKlass, 'getNotificationProvider', true);
let notificationProviderObj = new NotificationProviderKlass();
notificationProviderObj.warmUpConnectionPool({});

module.exports = NotificationProviderKlass;
