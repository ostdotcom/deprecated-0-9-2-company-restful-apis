"use strict";
/**
 * Manifest of elasticsearch core services.
 *
 * @module elasticsearch/services/es_services/search
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
              internal_error_identifier: 'l_es_s_es_s',
              api_error_identifier: 'unhandled_catch_response'
            });
          }
        })
    ;
  }
  , asyncPerform: function () {
    const oThis = this;
    return client.search( oThis.buildParams() );
  }
  , buildParams: function () {
    const oThis = this;

    return oThis.params;
  }
}

module.exports = Service;