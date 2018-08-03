'use strict';

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util');

const configStrategy = {
  dynamo: 'dynamo',

  dax: 'dax',

  redis: 'redis',

  memcached: 'memcached',

  in_memory: 'in_memory',

  value_geth: 'value_geth',

  value_constants: 'value_constants',

  utility_geth: 'utility_geth',

  utility_constants: 'utility_constants',

  autoscaling: 'autoscaling',

  es: 'es',

  constants: 'constants'
};

const kinds = {
  '1': configStrategy.dynamo,
  '2': configStrategy.dax,
  '3': configStrategy.redis,
  '4': configStrategy.memcached,
  '5': configStrategy.in_memory,
  '6': configStrategy.value_geth,
  '7': configStrategy.value_constants,
  '8': configStrategy.utility_geth,
  '9': configStrategy.utility_constants,
  '10': configStrategy.autoscaling,
  '11': configStrategy.es,
  '12': configStrategy.constants
};

configStrategy.kinds = kinds;

configStrategy.invertedKinds = util.invert(kinds);

module.exports = configStrategy;
