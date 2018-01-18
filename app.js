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
  , app = express()
  , responseHelper = require('./lib/formatter/response')
  , transactionRoutes = require('./routes/transaction')
  ;

// uncomment after placing your favicon in /public
app.use(logger('combined'));
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const assignParams = function (req, res, next) {
  if (req.method == 'POST') {
    req.decodedParams = req.body;
  } else if (req.method == 'GET') {
    req.decodedParams = req.query;
  }
  return next();
};

/*
  The below peice of code should always be before routes.
  Docs: https://www.npmjs.com/package/express-sanitized
*/
app.use(sanitizer());

app.use('/transaction', assignParams, transactionRoutes);

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

app.listen(3000, () => console.log('Example app listening on port 3000!'))

//module.exports = app;
