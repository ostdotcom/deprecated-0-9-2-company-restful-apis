"use strict";

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , v0ParamErrorConfig = require(rootPrefix + '/config/api_params/v0/error_config')
  , v1ParamErrorConfig = require(rootPrefix + '/config/api_params/v1/error_config')
  , apiErrorConfig = require(rootPrefix + '/config/api_params/api_error_config')
;

const routeMethods = {

  performer: function(req, res, next, CallerKlass, errorCode) {

    try{

      const oThis = this
          , errorConfig = oThis.fetchErrorConfig(req.decodedParams.apiVersion);

      var handleResponse = function (response) {
        response.renderResponse(res, errorConfig);
      };

      // TODO: req.decodedParams should be removed. It is just testing hack.
      const decodedParams = req.serviceParams || req.decodedParams;

      const callerObject = new CallerKlass(decodedParams);

      return callerObject.perform().then(handleResponse);

    } catch(err) {
      logger.notify(errorCode, 'Something went wrong', err);
      responseHelper.error(errorCode, 'something_went_wrong').renderResponse(res, errorConfig)
    }

  },
  
  replaceKey: function (inObj, existingKey, newKey) {
    const keyValue = inObj[existingKey];
    delete inObj[existingKey];
    inObj[newKey] = keyValue;

    return inObj;
  },

  /**
   * Fetch Error Config
   *
   * @param {String} apiVersion
   *
   * @return {object}
   */
  fetchErrorConfig: function (apiVersion) {

    var paramErrorConfig;

    if (apiVersion === apiVersions.v0) {
      paramErrorConfig = v0ParamErrorConfig;
    } else if (apiVersion === apiVersions.v0) {
      paramErrorConfig = v1ParamErrorConfig;
    } else if (apiVersion === apiVersions.internal) {
      paramErrorConfig = {};
    } else {
      throw "unsupported API Version " + apiVersion;
    }

    return {
      param_error_config: paramErrorConfig,
      api_error_config: apiErrorConfig
    }

  }

};

module.exports = routeMethods;