"use strict";

/*
 * Standard Response Formatter
 *
 * * Author: Kedar
 * * Date: 23/10/2017
 * * Reviewed by: Sunil
 */

const shortId = require('shortid')
  , logger = require('../logger/custom_console_logger');

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

  // Generate success response object
  successWithData: function (data) {
    return new Result(data);
  },

  // Generate error response object
  error: function(err_code, err_msg, err_prefix, error_detail) {
    err_code = 'companyRestFulApi(' + err_code + ":" + shortId.generate() + ')';
    if(err_prefix){
      err_code = err_prefix + "*" + err_code;
    }
    logger.error('### Error ### ' + err_code + ' ###');
    logger.error('### Error MSG ### ' + err_msg + ' ###');
    logger.error('### Error Detail ### ', error_detail, '###');
    return new Result({}, err_code, err_msg, error_detail);
  }

};

module.exports = responseHelper;