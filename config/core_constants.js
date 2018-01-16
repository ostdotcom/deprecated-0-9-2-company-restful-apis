"use strict";

function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}

define("ENVIRONMENT", process.env.CR_ENVIRONMENT);
define("SUB_ENV", process.env.CR_SUB_ENV);
define("NO_OF_POOLS", process.env.CR_NO_OF_POOLS);
define("TIMEZONE", process.env.CR_TIMEZONE);
define("MYSQL_HOST", process.env.CR_MYSQL_HOST);
define("MYSQL_USER", process.env.CR_MYSQL_USER);
define("MYSQL_PASSWORD", process.env.CR_MYSQL_PASSWORD);