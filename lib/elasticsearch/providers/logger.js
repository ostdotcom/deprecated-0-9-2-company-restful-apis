'use strict';

/**
 * Custom console logger
 *
 * @module lib/elasticsearch/providers/logger
 */

const OSTBase = require('@openstfoundation/openst-base');

const rootPrefix = '..',
  packageFile = require(rootPrefix + '/package.json'),
  esConstants = require(rootPrefix + '/config/es_constants');

const Logger = OSTBase.Logger,
  loggerLevel = esConstants.DEBUG_ENABLED == '1' ? Logger.LOG_LEVELS.TRACE : Logger.LOG_LEVELS.INFO,
  packageName = packageFile.name;

const logger = new Logger('company-restful-api-es', loggerLevel);

module.exports = logger;
