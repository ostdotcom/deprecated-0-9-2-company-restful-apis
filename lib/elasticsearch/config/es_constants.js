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

define("DEBUG_ENABLED", process.env.OST_DEBUG_ENABLED);