"use strict";
/**
 * Manifest of elasticsearch core services.
 *
 * @module elasticsearch/services/es_services/bulk
 */

const rootPrefix      = "../.."
    , logger          = require(rootPrefix + "/providers/logger")
    , client          = require(rootPrefix + "/providers/es")
    , responseHelper  = require(rootPrefix + "/providers/responseHelper")
;


const Service = function ( params ) {
  const oThis = this;
  oThis.params = params || {};
};
Service.prototype = {
  constructor: Service
  , params: null
  , perform : function () {
    const oThis = this;

    return oThis.asyncPerform()
        .catch(function(error) {
          if (responseHelper.isCustomResult(error)){
            return error;
          } else {
            logger.error(`${__filename}::perform::catch`);
            logger.error(error);

            return responseHelper.error({
              internal_error_identifier: 's_am_s_1',
              api_error_identifier: 'unhandled_catch_response',
              debug_options: {}
            });
          }
        })
    ;
  }
  , asyncPerform: function () {
    const oThis = this;
    return client.bulk( oThis.buildParams() );
  }
  , buildParams: function () {
    const oThis = this;

    return oThis.params;
  }
}

module.exports = Service;