"use strict";

const rootPrefix = '..'
  , express = require('express')
  , router = express.Router()
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/* Elb health checker request */
router.get('/', function (req, res, next) {
  const performer = function () {

    // 200 OK response needed for ELB Health checker
    logger.log(req.headers['user-agent']);   // "ELB-HealthChecker/2.0"

    if (req.headers['user-agent'] === "ELB-HealthChecker/2.0"){
      return responseHelper.successWithData({}).renderResponse(res);
    }else{
      return responseHelper.error('404', 'Not Found').renderResponse(res, 404);
    }

  };

  performer();

});

module.exports = router;