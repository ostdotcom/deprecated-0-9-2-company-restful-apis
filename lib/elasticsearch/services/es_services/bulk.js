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

  oThis.requestBody = [];
  if ( oThis.params.hasOwnProperty("body") ) {
    oThis.requestBody = oThis.params["body"] || oThis.requestBody;
  }

};
Service.prototype = {
  constructor: Service
  , params: null
  , requestBody: null
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
              internal_error_identifier: 'l_es_s_es_b_p',
              api_error_identifier: 'unhandled_catch_response'
            });
          }
        })
    ;
  }
  , asyncPerform: function () {
    const oThis = this;
    if ( !oThis.requestBody.length ) {
      return Promise.resolve(responseHelper.error({ 
        internal_error_identifier: "l_es_s_es_b_ap_no_op"
        , api_error_identifier: "no_operation_specified"
        , debug_options: {
          requestBody: oThis.requestBody
        }
      }));
    }

    return client.bulk( oThis.buildParams() )
      .then( function ( clientResponse ) {
        logger.win("Bulk Operation Successful!");
        clientResponse["result_type"] = "items";
        return responseHelper.successWithData( clientResponse );
      })
      .catch( function ( clientError ) {
        logger.error("Bulk Operation Failed!");
        return responseHelper.error({
          internal_error_identifier: "l_es_s_es_b_ap_c"
          , api_error_identifier: "invalid_elasticsearch_params"
          , debug_options: {
            "error_details": clientError
          }
        });
      })
    ;
  }
  , buildParams: function () {
    const oThis       = this
        , finalParams = Object.assign( {}, oThis.params )
    ;

    finalParams["body"] = oThis.requestBody;

    logger.debug("bluckParams:\n", finalParams );
    return finalParams;
  }
  , addRequestParams: function ( params ) {
    const oThis       = this;

    oThis.requestBody.push( params );
  }
}

module.exports = Service;