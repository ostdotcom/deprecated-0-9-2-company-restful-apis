"use strict";

const rootPrefix = '..';
var esConstants
  , elasticSearch
  , aws
  , awsEs
  , elasticSearchClientConfig
  , elasticSearchClient

try {
  aws = require('aws-sdk');
  awsEs = require('http-aws-es');
  elasticSearch = require('elasticsearch');
  esConstants = require(rootPrefix + '/config/es_constants');
} catch( e ) {
  console.error("Failed to initilaize some packages. Some methods may not work. Error:", e);
}

if(esConstants.ENVIRONMENT == 'development'){
  elasticSearchClientConfig = {
    host: esConstants.HOST,
    log: 'trace'
  }
} else {
  elasticSearchClientConfig = {
    host: esConstants.HOST,
    connectionClass: awsEs,
    awsConfig: new aws.Config({
      credentials: new aws.Credentials(esConstants.AWS_ACCESS_KEY, esConstants.AWS_SECRET_KEY),
      region: esConstants.AWS_REGION
    })
  }
}

elasticSearchClient = new elasticSearch.Client(elasticSearchClientConfig);

module.exports.elasticSearchClient = elasticSearchClient;

//elasticSearchClient.ping({
//  requestTimeout: 30000,
//}, function (error, response, status) {
//  if (error) {
//    console.error('elasticsearch cluster is down: ', error, status);
//  } else {
//    console.log('All is well: ', response, status);
//  }
//});