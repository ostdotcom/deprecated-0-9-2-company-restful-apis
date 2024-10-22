'use strict';

const rootPrefix = '..',
  packageFile = require(rootPrefix + '/package.json');

function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}

define('ENVIRONMENT', process.env.CR_ENVIRONMENT);
define('AWS_ES_ACCESS_KEY', process.env.AWS_ES_ACCESS_KEY);
define('AWS_ES_SECRET_KEY', process.env.AWS_ES_SECRET_KEY);
define('AWS_ES_REGION', process.env.AWS_ES_REGION);
define('ES_HOST', process.env.CR_ES_HOST);
define('DEBUG_ENABLED', 0);
define('DYNAMO_INSERT_EVENT_NAME', 'INSERT');
define('DYNAMO_UPDATE_EVENT_NAME', 'MODIFY');
define('DYNAMO_DELETE_EVENT_NAME', 'REMOVE');
