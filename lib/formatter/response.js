"use strict";

/*
 * Standard Response Formatter
 *
 * * Author: Kedar
 * * Date: 23/10/2017
 * * Reviewed by: Sunil
 */

const shortId = require('shortid')
;

const rootPrefix = "../.."
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

function Result(data, err_code, err_msg, error_detail) {

  this.success = (err_code == null);

  this.data = data || {};

  error_detail = error_detail || {};
  const paramErrors = error_detail.paramErrors || {};

  delete error_detail.paramErrors;

  if (!this.success) {
    this.err = {
      code: err_code,
      msg: err_msg,
      param: paramErrors,
      error_data: (error_detail || {})
    };
  }

  // Check if response has success
  this.isSuccess = function () {
    return this.success;
  };

  // Check if response is not success. More often not success is checked, so adding a method.
  this.isFailure = function () {
    return !this.isSuccess();
  };

  // Format data to hash
  this.toHash = function () {
    var s = {};
    if (this.success) {
      s.success = true;
      s.data = this.data;
    } else {
      s.success = false;
      s.err = this.err;
    }

    return s;
  };

  // Render final error or success response
  this.renderResponse = function (res, status) {
    status = status || 200;
    logger.requestCompleteLog(status);
    return res.status(status).json(this.toHash());
  };
}

const responseHelper = {

  /**
   * Success with data
   *
   * @param {object} data - data to be sent with success result
   *
   * @return {result}
   */
  successWithData: function (data) {
    return new Result(data);
  },

  /**
   * Error result
   *
   * @param {object} err_code - error code
   * @param {string} err_msg - error message
   * @param {object} internal_error_detail - error detail
   * @param {object} options - optional params object
   * @param {boolean} options.sendErrorEmail - boolean which decides email has to be sent out to Devs
   * @param {boolean} options.clientId - clientId for which this error was thrown
   *
   * @return {result}
   */
  error: function(err_code, err_msg, internal_error_detail, options) {

    var err_code_for_log = 'companyRestFulApi(' + err_code + ":" + shortId.generate() + ')';

    if(options && !options.sendErrorEmail){
      logger.error(err_code_for_log, err_msg, internal_error_detail);
    } else {
      var notifyParams = {};
      if (options && options.clientId) {
        notifyParams.clientId = options.clientId;
      }
      logger.notify(err_code, err_msg, internal_error_detail, notifyParams);
    }

    return new Result({}, err_code_for_log, err_msg, internal_error_detail);

  },

  /**
   * return true if the object passed is of Result class
   *
   * @param {object} obj - object to check instanceof
   *
   * @return {bool}
   */
  isCustomResult: function(obj) {
    return obj instanceof Result
  },

  /**
   * Error result
   *
   * @param {object} internal_code - error code
   * @param {array} paramErrors - error detail
   *
   * @return {result}
   */
  paramValidationError: function(internal_code, paramErrors) {

    const oThis = this;

    return oThis.error(internal_code, 'API Param Validation Errors', {paramErrors: paramErrors});

  }

};

module.exports = responseHelper;