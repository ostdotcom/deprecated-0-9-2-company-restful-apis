"use strict";

/**
 * Custom console logger
 *
 * @module helpers/custom_console_logger
 */

const OSTBase   = require('@openstfoundation/openst-base');

const rootPrefix = ".."
  , packageFile = require(rootPrefix + '/package.json')
  , coreConstants = require(rootPrefix + '/config/es_constants')
;

const Logger = OSTBase.Logger
  , loggerLevel = (coreConstants.DEBUG_ENABLED == '1' ? Logger.LOG_LEVELS.TRACE : Logger.LOG_LEVELS.INFO)
  , packageName = packageFile.name
;

const logger = new Logger("openst-platform", loggerLevel);

module.exports = logger;
