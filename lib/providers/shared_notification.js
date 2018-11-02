'use strict';

/**
 * RabbitMQ instance provider which is not client specific.
 *
 * @module lib/providers/shared_notification
 */

const OpenStNotification = require('@openstfoundation/openst-notification');

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  SharedrmqDataHelper = require(rootPrefix + '/helpers/config_strategy/rabbitmq_endpoints.js'),
  configStrategyConstants = require(rootPrefix + '/lib/global_constant/config_strategy');

/**
 * Constructor
 *
 * @constructor
 */
const SharedRabbitMqProviderKlass = function() {
  const oThis = this;
  oThis.sharedRmqData = null;
};

SharedRabbitMqProviderKlass.prototype = {
  /**
   * Get provider
   *
   * @return {object}
   */
  getInstance: async function(params) {
    const oThis = this;

    let sharedRmqDataHash = await oThis.getSharedRmqData();

    const notificationConfigStrategy = {
      OST_RMQ_USERNAME: sharedRmqDataHash.OST_SHARED_RMQ_USERNAME,
      OST_RMQ_PASSWORD: sharedRmqDataHash.OST_SHARED_RMQ_PASSWORD,
      OST_RMQ_HOST: sharedRmqDataHash.OST_SHARED_RMQ_HOST,
      OST_RMQ_PORT: sharedRmqDataHash.OST_SHARED_RMQ_PORT,
      OST_RMQ_CLUSTER_NODES: sharedRmqDataHash.OST_SHARED_RMQ_CLUSTER_NODES,
      OST_RMQ_HEARTBEATS: sharedRmqDataHash.OST_SHARED_RMQ_HEARTBEATS,
      OST_RMQ_SUPPORT: coreConstants.OST_RMQ_SUPPORT
    };
    if (params) {
      Object.assign(notificationConfigStrategy, { CONNECTION_WAIT_SECONDS: params.connectionWaitSeconds });
    }

    return OpenStNotification.getInstance(notificationConfigStrategy);
  },

  getSharedRmqData: async function() {
    const oThis = this;

    if (!oThis.sharedRmqData) {
      let sharedRmqDataHelperObj = new SharedrmqDataHelper(),
        sharedRmqResponse = await sharedRmqDataHelperObj.get();

      if (sharedRmqResponse) {
        oThis.sharedRmqData = sharedRmqResponse;
      } else {
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'li_pr_sn_1',
            api_error_identifier: 'something_went_wrong',
            debug_options: {}
          })
        );
      }
    }
    return Promise.resolve(oThis.sharedRmqData);
  }
};

module.exports = new SharedRabbitMqProviderKlass();
