"use strict";

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , apiParamsValidator = require(rootPrefix + '/lib/validators/api_params')
;

const routeMethods = {

  performer: async function (req, res, next, CallerKlass, errorCode, afterValidationFunc, dataFormatterFunc) {

    const oThis = this
      , errorConfig = basicHelper.fetchErrorConfig(req.decodedParams.apiVersion)
    ;

    return oThis.asyncPerform(req, res, next, CallerKlass, afterValidationFunc, dataFormatterFunc)
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          error.renderResponse(res, errorConfig);
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

  asyncPerform: async function (req, res, next, CallerKlass, afterValidationFunc, dataFormatterFunc) {
    req.decodedParams = req.decodedParams || {};

    const oThis = this
      , errorConfig = basicHelper.fetchErrorConfig(req.decodedParams.apiVersion);

    const apiParamsValidatorRsp = await new apiParamsValidator({
      api_name: req.decodedParams.apiName,
      api_version: req.decodedParams.apiVersion,
      api_params: req.decodedParams
    }).perform();

    req.serviceParams = apiParamsValidatorRsp.data.sanitisedApiParams;

    if (afterValidationFunc) {
      req.serviceParams = await afterValidationFunc(req.serviceParams);
    }

    // TODO: temp. remove in sometime
    logger.debug('req.serviceParams', req.serviceParams);
    logger.debug('req.decodedParams', req.decodedParams);

    var handleResponse = async function (response) {

      if (response.isSuccess() && dataFormatterFunc) {
        // if requires this function could reformat data as per API version requirements.
        await dataFormatterFunc(response);
      }

      response.renderResponse(res, errorConfig);

    };

    return new CallerKlass(req.serviceParams).perform().then(handleResponse);

  },

  replaceKey: function (inObj, existingKey, newKey) {
    const keyValue = inObj[existingKey];
    if (!inObj.hasOwnProperty(keyValue)) {
      return inObj;
    }

    delete inObj[existingKey];
    inObj[newKey] = keyValue;

    return inObj;
  }

};

module.exports = routeMethods;