"use strict";
/**
 * Manifest of elasticsearch core services.
 *
 * @module elasticsearch/services/es_services/create
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
  , actionDescription: null
  , actionBody: null
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
              internal_error_identifier: 'l_es_s_es_c_p',
              api_error_identifier: 'unhandled_catch_response'
            });
          }
        })
    ;
  }
  , asyncPerform: function () {
    const oThis = this;
    let params;
    try {
      params = oThis.buildParams();
      return client.create( params );
      //Almost same as bulk.

    } catch( e ) {
      return Promise.reject( responseHelper.error({
        internal_error_identifier: 'l_es_s_es_c_ap_in_p',
        api_error_identifier: ''
      }))
    }
  }
  , buildParams: function () {
    const oThis = this;

    return oThis.params;
  }

  , setActionDescription: function ( actionDescription ) {
    const oThis = this;
    // Map here.
    oThis.actionDescription = actionDescription;
  }

  , setActionBody: function ( body ) {
    const oThis = this;
    // Map here.
    oThis.actionBody = actionBody;
  }


}

module.exports = Service;