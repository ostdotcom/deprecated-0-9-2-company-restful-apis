"use strict";

/*
 * Standard Response Formatter
 */

const rootPrefix = '../..'
  , OSTCore = require('@openstfoundation/openst-base')
  , responseHelper = new OSTCore.responseHelper({moduleName: 'companyRestFulApi'})
;

module.exports = responseHelper;