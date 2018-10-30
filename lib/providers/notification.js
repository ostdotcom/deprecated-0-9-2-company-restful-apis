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
  configStrategyModel = require(rootPrefix + '/app/models/config_strategy'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy'),
  configStrategyCacheKlass = require(rootPrefix + '/lib/shared_cache_multi_management/config_strategy'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id');

/**
 * Constructor
 *
 * @constructor
 */
const NotificationProviderKlass = function(configStrategy, instanceComposer) {};

NotificationProviderKlass.prototype = {
  maximumWaitInseconds: 30,

  /**
   * get provider
   *
   * @return {object}
   */
  getInstance: async function(params) {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    Object.assign(configStrategy, { OST_RMQ_SUPPORT: coreConstants.OST_RMQ_SUPPORT });
    if (params) {
      Object.assign(configStrategy, { CONNECTION_WAIT_SECONDS: params.connectionWaitSeconds });
    }

    return OpenStNotification.getInstance(configStrategy);
  },

  emitEvent: async function() {
    console.log('Process is being emitted');
    process.emit('ost_rmq_fail', 'Process_emitted');
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

process.on('switchConnectionHost', function(msg) {
  let params = { down_enpoint: msg.failedHost, live_endpoint: msg.newHost };
  customCacheSetForPreferredRMQEndPoint(params);
});

const customCacheSetForPreferredRMQEndPoint = async function(params) {
  const downEndpoint = params.down_enpoint,
    liveEndpoint = params.live_endpoint;

  let queryResponse = await new configStrategyModel()
    .select(['id', 'unencrypted_params'])
    .where(['kind = ?', configStrategyConstants.invertedKinds[configStrategyConstants.rmq]])
    .fire();

  console.log('params-----', params);
  console.log('queryResponse-----', queryResponse);
  if (queryResponse) {
    for (let index in queryResponse) {
      let rmqParams = JSON.parse(queryResponse[index].unencrypted_params);
      if (rmqParams.OST_RMQ_HOST == downEndpoint) {
        let paramsToUpdate = rmqParams;

        if (rmqParams.OST_RMQ_CLUSTER_NODES.includes(liveEndpoint)) {
          paramsToUpdate.OST_RMQ_HOST = liveEndpoint;
          await setConfigStrategyCacheKlass(queryResponse[index].id, paramsToUpdate);
        } else {
          let currentEndPoint;
          for (var i = 0; i < rmqParams.OST_RMQ_CLUSTER_NODES.length; i++) {
            if (rmqParams.OST_RMQ_CLUSTER_NODES[i] != downEndpoint) {
              currentEndPoint = rmqParams.OST_RMQ_CLUSTER_NODES[i];
              break;
            }
          }
          if (!currentEndPoint) {
            logger.warn('No active end points in the array');
          } else {
            paramsToUpdate.OST_RMQ_HOST = currentEndPoint;
            await setConfigStrategyCacheKlass(queryResponse[index].id, paramsToUpdate);
          }
        }
      }
    }
  }
};

const setConfigStrategyCacheKlass = async function(id, updatedParams) {
  let configStrategyCacheObj = new configStrategyCacheKlass({ strategyIds: [id] });
  await configStrategyCacheObj._setCache(id, updatedParams);
};

module.exports = NotificationProviderKlass;
