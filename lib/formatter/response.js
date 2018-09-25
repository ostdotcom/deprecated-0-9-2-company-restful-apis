'use strict';

/*
 * Standard Response Formatter
 */

const rootPrefix = '../..',
  OSTBase = require('@openstfoundation/openst-base'),
  responseHelper = new OSTBase.responseHelper({
    moduleName: 'companyRestFulApi'
  });

module.exports = responseHelper;
