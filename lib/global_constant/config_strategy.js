'use strict';

const configStrategy = {
  dynamo: 'dynamo',

  dax: 'dax',

  redis: 'redis',

  memcached: 'memcached',

  value_geth: 'value_geth',

  value_constants: 'value_constants',

  utility_geth: 'utility_geth',

  utility_constants: 'utility_constants',

  autoscaling: 'autoscaling',

  es: 'es',

  constants: 'constants'
};

module.exports = configStrategy;
