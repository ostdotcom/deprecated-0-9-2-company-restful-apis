"use strict";

/*
 * Standard Response Formatter
 */

const rootPrefix = '..'
    , OSTBase = require('@openstfoundation/openst-base')
    , responseHelper = new OSTBase.responseHelper({
      moduleName: 'companyRestFulApiElasticSearch'
    })
    , errorConfig = require(rootPrefix + "/config/error_config")
;


const _super_error = responseHelper.error;
responseHelper.error = function ( params ) {
  if ( params && typeof params === "object" ) {
    if( !params.hasOwnProperty("error_config") ) {
      console.log("errorConfig", errorConfig);
      params.error_config = errorConfig;
    }

    if ( !params.hasOwnProperty("debug_options") ) {
      params.debug_options = {};
    }
  }
  return _super_error.call(responseHelper, params);
};

module.exports = responseHelper;