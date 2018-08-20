'use strict';

/**
 * OpenStPayments Provider
 *
 * @module lib/providers/payments
 */

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer');

var esConstants, elasticSearch, aws, awsEs, elasticSearchClientConfig, elasticSearchClient, logger;
require('http').globalAgent.keepAlive = true;
aws = require('aws-sdk');
awsEs = require('http-aws-es');
elasticSearch = require('elasticsearch');
esConstants = require(rootPrefix + '/lib/elasticsearch/config/es_constants');
logger = require(rootPrefix + '/lib/elasticsearch/providers/logger');

const instanceMap = {};

/**
 * Constructor
 *
 * @constructor
 */
const EsProviderKlass = function(configStrategy, instanceComposer) {};

EsProviderKlass.prototype = {
  getInstanceKey: function(configStrategy) {
    if (!configStrategy.hasOwnProperty('CR_ES_HOST')) {
      throw 'CR_ES_HOST parameter is missing.';
    }
    if (configStrategy.CR_ES_HOST === undefined) {
      throw 'CR_ES_HOST parameter is empty.';
    }
    if (!configStrategy.hasOwnProperty('AWS_ES_ACCESS_KEY')) {
      throw 'AWS_ES_ACCESS_KEY parameter is missing.';
    }
    if (configStrategy.AWS_ES_ACCESS_KEY === undefined) {
      throw 'AWS_ES_ACCESS_KEY parameter is empty.';
    }
    if (!configStrategy.hasOwnProperty('AWS_ES_SECRET_KEY')) {
      throw 'AWS_ES_SECRET_KEY parameter is missing.';
    }
    if (configStrategy.AWS_ES_SECRET_KEY === undefined) {
      throw 'AWS_ES_SECRET_KEY parameter is empty.';
    }
    if (!configStrategy.hasOwnProperty('AWS_ES_REGION')) {
      throw 'AWS_ES_REGION parameter is missing.';
    }
    if (configStrategy.AWS_ES_REGION === undefined) {
      throw 'AWS_ES_REGION parameter is empty.';
    }

    let endPointdetails = null;

    endPointdetails =
      configStrategy.CR_ES_HOST.toString() +
      '-' +
      configStrategy.AWS_ES_ACCESS_KEY.toString() +
      '-' +
      configStrategy.AWS_ES_REGION.toString() +
      '-' +
      configStrategy.AWS_ES_SECRET_KEY.toString();

    return endPointdetails;
  },

  /**
   * get provider
   *
   * @return {object}
   */
  getInstance: function() {
    const oThis = this,
      configStrategy = oThis.ic().configStrategy;

    let instanceKey = oThis.getInstanceKey(configStrategy);

    let _instance = instanceMap[instanceKey];

    if (!_instance) {
      try {
        aws.config.httpOptions.keepAlive = true;
        aws.config.httpOptions.disableProgressEvents = false;
      } catch (e) {
        logger.error('Failed to initilaize some packages. Some methods may not work. Error:', e);
      }

      elasticSearchClientConfig = {
        host: configStrategy.CR_ES_HOST,
        log: {
          type: function() {
            return logger;
          },
          level: 'trace'
        },
        apiVersion: '6.2'
      };
      if (esConstants.ENVIRONMENT != 'development') {
        elasticSearchClientConfig.connectionClass = awsEs;
        elasticSearchClientConfig.awsConfig = new aws.Config({
          credentials: new aws.Credentials(configStrategy.AWS_ES_ACCESS_KEY, configStrategy.AWS_ES_SECRET_KEY),
          region: configStrategy.AWS_ES_REGION
        });
      }

      logger.log('elasticSearchClientConfig', elasticSearchClientConfig);
      elasticSearchClient = new elasticSearch.Client(elasticSearchClientConfig);

      _instance = elasticSearchClient;
      instanceMap[instanceKey] = _instance;
    }
    return _instance;
  }
};

InstanceComposer.register(EsProviderKlass, 'getEsProvider', true);

module.exports = EsProviderKlass;
