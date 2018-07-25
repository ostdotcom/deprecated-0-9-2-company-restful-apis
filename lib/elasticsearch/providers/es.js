'use strict';

const rootPrefix = '..';
var esConstants, elasticSearch, aws, awsEs, elasticSearchClientConfig, elasticSearchClient, logger;

try {
  require('http').globalAgent.keepAlive = true;
  aws = require('aws-sdk');
  awsEs = require('http-aws-es');
  elasticSearch = require('elasticsearch');
  esConstants = require(rootPrefix + '/config/es_constants');
  logger = require(rootPrefix + '/providers/logger');

  aws.config.httpOptions.keepAlive = true;
  aws.config.httpOptions.disableProgressEvents = false;
} catch (e) {
  console.error('Failed to initilaize some packages. Some methods may not work. Error:', e);
}

elasticSearchClientConfig = {
  host: esConstants.ES_HOST,
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
    credentials: new aws.Credentials(esConstants.AWS_ACCESS_KEY, esConstants.AWS_SECRET_KEY),
    region: esConstants.AWS_REGION
  });
}

logger.log('elasticSearchClientConfig', elasticSearchClientConfig);
elasticSearchClient = new elasticSearch.Client(elasticSearchClientConfig);

module.exports = elasticSearchClient;
