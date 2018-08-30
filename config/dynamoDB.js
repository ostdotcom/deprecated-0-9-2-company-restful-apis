'use strict';

const rootPrefix = '..',
  coreConstants = require(rootPrefix + '/config/core_constants');

// Dynamo DB connection config details
/*var ddbConnectionConfig = {
  'apiVersion': process.env.OS_DYNAMODB_API_VERSION,
  'accessKeyId': process.env.OS_DYNAMODB_ACCESS_KEY_ID,
  'secretAccessKey': process.env.OS_DYNAMODB_SECRET_ACCESS_KEY,
  'region': process.env.OS_DYNAMODB_REGION,
  'endpoint': process.env.OS_DYNAMODB_ENDPOINT
}*/

//Config for DynamoDB and DAX
let ddbConnectionConfig = {
  OS_DAX_API_VERSION: process.env.OS_DAX_API_VERSION,
  OS_DAX_ACCESS_KEY_ID: process.env.OS_DAX_ACCESS_KEY_ID,
  OS_DAX_SECRET_ACCESS_KEY: process.env.OS_DAX_SECRET_ACCESS_KEY,
  OS_DAX_ENDPOINT: process.env.OS_DAX_ENDPOINT,
  OS_DAX_REGION: process.env.OS_DAX_REGION,
  OS_DAX_ENABLED: process.env.OS_DAX_ENABLED,
  OS_DAX_SSL_ENABLED: process.env.OS_DAX_SSL_ENABLED,

  OS_DYNAMODB_LOGGING_ENABLED: process.env.OS_DYNAMODB_LOGGING_ENABLED,
  OS_DYNAMODB_SSL_ENABLED: process.env.OS_DYNAMODB_SSL_ENABLED,

  OS_DYNAMODB_API_VERSION: process.env.OS_DYNAMODB_API_VERSION,
  OS_DYNAMODB_ACCESS_KEY_ID: process.env.OS_DYNAMODB_ACCESS_KEY_ID,
  OS_DYNAMODB_SECRET_ACCESS_KEY: process.env.OS_DYNAMODB_SECRET_ACCESS_KEY,
  OS_DYNAMODB_REGION: process.env.OS_DYNAMODB_REGION,
  OS_DYNAMODB_ENDPOINT: process.env.OS_DYNAMODB_ENDPOINT
};

if (process.env.OS_DYNAMODB_SSL_ENABLED == 1) {
  ddbConnectionConfig['sslEnabled'] = true;
} else {
  ddbConnectionConfig['sslEnabled'] = false;
}

if (process.env.OS_DYNAMODB_LOGGING_ENABLED == 1) {
  ddbConnectionConfig['logger'] = console;
}

module.exports = ddbConnectionConfig;
