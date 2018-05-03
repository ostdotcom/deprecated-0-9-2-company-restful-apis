"use strict";

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , basicHelper = require(rootPrefix + '/helpers/basic')
;

const routeMethods = {

  performer: function(req, res, next, CallerKlass, errorCode) {

    try{

      const oThis = this
          , errorConfig = basicHelper.fetchErrorConfig(req.decodedParams.apiVersion);

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
  }

};

module.exports = routeMethods;