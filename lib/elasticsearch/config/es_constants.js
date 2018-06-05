"use strict";

const rootPrefix = '..'
  , packageFile = require(rootPrefix + '/package.json')
;

function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}

define("ENVIRONMENT", process.env.CR_ENVIRONMENT);
define("AWS_ACCESS_KEY", process.env.CR_AWS_ACCESS_KEY);
define("AWS_SECRET_KEY", process.env.CR_AWS_SECRET_KEY);
define("AWS_REGION", process.env.CR_AWS_REGION);
define("ES_HOST", process.env.CR_ES_HOST);