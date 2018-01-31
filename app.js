"use strict";
/*
 * Main application file
 *
 * * Author: Rachin
 * * Date: 23/10/2017
 * * Reviewed by: Sunil
 */
const express = require('express')
  , path = require('path')
  , logger = require('morgan')
  , cookieParser = require('cookie-parser')
  , bodyParser = require('body-parser')
  , helmet = require('helmet')
  , sanitizer = require('express-sanitized')
  , customUrlParser = require('url')
;

const rootPrefix = '.'
  , jwtAuth = require(rootPrefix + '/lib/jwt/jwt_auth')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , transactionRoutes = require(rootPrefix + '/routes/transaction')
  , onBoardingRoutes = require(rootPrefix + '/routes/on_boarding')
  , stakeRoutes = require(rootPrefix + '/routes/stake')
  , clientUsersRoutes = require(rootPrefix + '/routes/client_users')
  , addressRoutes = require(rootPrefix + '/routes/address')
  , inputValidator = require(rootPrefix + '/lib/authentication/validate_signature')
;

const app = express()
;

// uncomment after placing your favicon in /public
app.use(logger('combined'));
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const assignParams = function (req) {
  if (req.method == 'POST') {
    req.decodedParams = req.body;
  } else if (req.method == 'GET') {
    req.decodedParams = req.query;
  }
};

const validateApiSignature = function (req, res, next){
  assignParams(req);
  return next();

  const handleParamValidationResult = function(result) {
    if(result.isSuccess()){
      req.decodedParams["client_id"] = result.data["clientId"];
      next();
    } else {
      return responseHelper.error('401', 'Unauthorized').renderResponse(res, 401);
    }
  };

  return inputValidator.perform(req.decodedParams, customUrlParser.parse(req.originalUrl).pathname)
    .then(handleParamValidationResult);
};

// before action for verifying the jwt token and setting the decoded info in req obj
const decodeJwt = function(req, res, next) {

  var token = null;
  if (req.method == 'POST') {
    token = req.body.token;
  } else if (req.method == 'GET') {
    token = req.query.token;
  } else {
    return next();
  }

  // Set the decoded params in the re and call the next in control flow.
  const jwtOnResolve = function (reqParams) {
    req.decodedParams = reqParams.data;
    // Validation passed.
    return next();
  };

  // send error, if token is invalid
  const jwtOnReject = function (err) {
    console.error(err);
    return responseHelper.error('a_1', 'Invalid token or expired').renderResponse(res);
  };

  // Verify token
  Promise.resolve(
    jwtAuth.verifyToken(token, 'saasApi')
      .then(
        jwtOnResolve,
        jwtOnReject
      )
  ).catch(function (err) {
    console.error(err);
    responseHelper.error('a_2', 'Something went wrong').renderResponse(res)
  });

};

/*
  The below peice of code should always be before routes.
  Docs: https://www.npmjs.com/package/express-sanitized
*/
app.use(sanitizer());

app.use('/transaction', validateApiSignature, transactionRoutes);

app.use('/users', validateApiSignature, clientUsersRoutes);

app.use('/addresses', validateApiSignature, addressRoutes);

app.use('/on-boarding', decodeJwt, onBoardingRoutes);

app.use('/stake', decodeJwt, stakeRoutes);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  return responseHelper.error('404', 'Not Found').renderResponse(res, 404);
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  console.error(err);
  return responseHelper.error('500', 'Something went wrong').renderResponse(res, 500);
});

app.listen(3000, function(){console.log('Example app listening on port 3000!')});

//module.exports = app;
