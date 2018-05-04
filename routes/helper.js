"use strict";

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , apiParamsValidator = require(rootPrefix + '/lib/validators/api_params')
;

const routeMethods = {

  performer: async function(req, res, next, CallerKlass, errorCode) {
    const oThis = this;

    return oThis.asyncPerform()
        .catch(function(error) {
          if (responseHelper.isCustomResult(error)) {
            error.renderResponse(res, req.serviceParams);
          } else {
            logger.notify(errorCode, 'Something went wrong', error);
            responseHelper.error({
              internal_error_identifier: errorCode,
              api_error_identifier: 'unhandled_catch_response',
              debug_options: {}
            }).renderResponse(res, errorConfig);
          }
        });
  },
  
  asyncPerform: async function(req, res, next, CallerKlass, errorCode) {

    const oThis = this
        , errorConfig = basicHelper.fetchErrorConfig(req.decodedParams.apiVersion);

    const apiParamsValidatorRsp = await new apiParamsValidator({
      api_name: req.decodedParams.apiName,
      api_version: req.decodedParams.apiVersion,
      api_params: req.decodedParams
    }).perform();

    req.serviceParams = apiParamsValidatorRsp.data.sanitisedApiParams;

    // TODO: temp. remove in sometime
    logger.debug('req.serviceParams', req.serviceParams);
    logger.debug('req.decodedParams', req.decodedParams);

    // TODO: req.decodedParams should be removed. It is just testing hack.
    const decodedParams = req.serviceParams || req.decodedParams;

    var handleResponse = function (response) {
      response.renderResponse(res, errorConfig);
    };

    return new CallerKlass(decodedParams).perform().then(handleResponse);

  },
  
  replaceKey: function (inObj, existingKey, newKey) {
    const keyValue = inObj[existingKey];
    delete inObj[existingKey];
    inObj[newKey] = keyValue;

    return inObj;
  }

};

module.exports = routeMethods;