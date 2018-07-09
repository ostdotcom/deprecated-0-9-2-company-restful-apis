"use strict";
/**
 * Manifest of elasticsearch core services.
 *
 * @module elasticsearch/services/es_services/update
 */

const rootPrefix      = "../.."
    , logger          = require(rootPrefix + "/providers/logger")
    , client          = require(rootPrefix + "/providers/es")
    , responseHelper  = require(rootPrefix + "/providers/responseHelper")
;

const Service = function ( params ) {
  const oThis = this;
  oThis.params = params || {};
  oThis.requestBody = {};
  if ( oThis.params.hasOwnProperty("body") ) {
    oThis.requestBody = oThis.params["body"] || oThis.requestBody;
  }
};
Service.prototype = {
  constructor: Service
  , params: null
  , actionDescription: null
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
              internal_error_identifier: 'l_es_s_es_u_p',
              api_error_identifier: 'unhandled_catch_response'
            });
          }
        })
    ;
  }
  , asyncPerform: function () {
    const oThis = this;
    if ( !oThis.requestBody 
      || !(typeof oThis.requestBody === "object") 
      || !(Object.keys( oThis.requestBody ).length)
    ) {
      return Promise.resolve(responseHelper.error({ 
        internal_error_identifier: "l_es_s_es_u_ap_no_op"
        , api_error_identifier: "no_operation_specified"
        , debug_options: {
          requestBody: oThis.requestBody
        }
      }));
    }

    let params;
    try {
      params = oThis.buildParams();
      return client.index( oThis.buildParams() )
        .then( function ( clientResponse ) {
          logger.win(`Update Operation Successful and took ${clientResponse.took} ms`);
          logger.debug("params", params);
          logger.debug("update Operation clientResponse:", clientResponse);
          return responseHelper.successWithData( clientResponse );
        })
        .catch( function ( clientError ) {
          logger.error("Update Operation Failed!");
          logger.debug("params", params);
          return responseHelper.error({
            internal_error_identifier: "l_es_s_es_u_ap_c"
            , api_error_identifier: "invalid_elasticsearch_params"
            , debug_options: {
              "error_details": clientError
            }
          });
        })
      ;
    } catch( e ) {
      return Promise.reject( responseHelper.error({
        internal_error_identifier: 'l_es_s_es_u_ap_in_p',
        api_error_identifier: ''
      }))
    }
  }
  , buildParams: function () {
    const oThis = this
        , finalParams = Object.assign( {}, oThis.params, oThis.actionDescription )
    ;

    finalParams["body"] = oThis.requestBody;
    return finalParams;
  }

  , setActionDescription: function ( actionDescription ) {
    const oThis = this;
    // Map here.
    oThis.actionDescription = actionDescription;
  }

  , setRequestBody: function ( requestBody ) {
    const oThis = this;
    oThis.requestBody = requestBody;
  }


};

module.exports = Service;