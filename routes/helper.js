"use strict";

const rootPrefix = '..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

const routeMethods = {

  performer: function(req, res, next, CallerKlass, errorCode) {

    try{

      var handleResponse = function (response) {
        response.renderResponse(res);
      };

      const decodedParams = req.serviceParams;

      const callerObject = new CallerKlass(decodedParams);

      return callerObject.perform().then(handleResponse);

    } catch(err) {
      logger.notify(errorCode, 'Something went wrong', err);
      responseHelper.error(errorCode, 'Something went wrong').renderResponse(res)
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