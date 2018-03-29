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

  if (!this.success) {
    this.err = {
      code: err_code,
      msg: err_msg,
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
   * @param {string} err_prefix - error prefix
   * @param {object} error_detail - error detail
   * @param {object} options - error code
   *
   * @return {result}
   */
  error: function(err_code, err_msg, err_prefix, error_detail, options) {

    var err_code_for_log = 'companyRestFulApi(' + err_code + ":" + shortId.generate() + ')';

    if(err_prefix){
      err_code = err_prefix + "*" + err_code;
      err_code_for_log = err_prefix + "*" + err_code_for_log;
    }

    if(options && !options.sendErrorEmail){
      logger.error(err_code_for_log, err_msg, error_detail);
    } else {
      logger.notify(err_code, err_msg, error_detail);
    }

    return new Result({}, err_code_for_log, err_msg, error_detail);

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
  }

};

module.exports = responseHelper;