"use strict";

/**
 * Custom console logger
 *
 * @module helpers/custom_console_logger
 */

const getNamespace = require('continuation-local-storage').getNamespace
  // Get common local storage namespace to read
  // request identifiers for debugging and logging
  , requestNamespace = getNamespace('openST-Platform-NameSpace')
  , openSTNotification = require('@openstfoundation/openst-notification')
;

const rootPrefix = "../.."
  , coreConstants = require(rootPrefix + '/config/core_constants')
;

const packageName = coreConstants.PACKAGE_NAME
  , environment = coreConstants.ENVIRONMENT
  , subEnvironment = coreConstants.SUB_ENVIRONMENT
;

const CONSOLE_RESET = "\x1b[0m"
  , ERR_PRE = "\x1b[31m" //Error. (RED)
  , NOTE_PRE = "\x1b[91m" //Notify Error. (Purple)
  , INFO_PRE = "\x1b[35m  " //Info (Magenta)
  , WIN_PRE = "\x1b[32m" //Success (GREEN)
  , LOG_PRE = "\x1b[33m  " //Info (YELLOW)
  , DEBUG_PRE = "\x1b[36m" //Debug log (Cyan)
  , WARN_PRE = "\x1b[43m"
  , STEP_PRE = "\n\x1b[34m"
;

/**
 * Method to append Request in each log line.
 *
 * @param {string} message
 */
const appendRequest = function (message) {
  var newMessage = "";
  if (requestNamespace) {
    if (requestNamespace.get('reqId')) {
      newMessage += "[" + requestNamespace.get('reqId') + "]";
    }
    const hrTime = process.hrtime();
    newMessage += "[" + timeInMilli(hrTime) + "]";
  }
  newMessage += message;
  return newMessage;
};

/**
 * Method to convert Process hrTime to Milliseconds
 *
 * @param {number} hrTime - this is the time in hours
 *
 * @return {number} - returns time in milli seconds
 */
const timeInMilli = function (hrTime) {
  return (hrTime[0] * 1000 + hrTime[1] / 1000000);
};

/**
 * Find out the difference between request start time and complete time
 */
const calculateRequestTime = function () {
  var reqTime = 0;
  if (requestNamespace && requestNamespace.get('startTime')) {
    const hrTime = process.hrtime();
    reqTime = timeInMilli(hrTime) - timeInMilli(requestNamespace.get('startTime'));
  }
  return reqTime;
};

/**
 * Custom COnsole Logger
 *
 * @constructor
 */
const CustomConsoleLoggerKlass = function () {
};

CustomConsoleLoggerKlass.prototype = {
  /**
   * @ignore
   *
   * @constant {string}
   */
  STEP_PRE: STEP_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  WARN_PRE: WARN_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  LOG_PRE: LOG_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  DEBUG_PRE: DEBUG_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  WIN_PRE: WIN_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  INFO_PRE: INFO_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  ERR_PRE: ERR_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  NOTE_PRE: NOTE_PRE,

  /**
   * @ignore
   *
   * @constant {string}
   */
  CONSOLE_RESET: CONSOLE_RESET,

  /**
   * Log step
   */
  step: function () {
    var args = [appendRequest(this.STEP_PRE)];
    args = args.concat(Array.prototype.slice.call(arguments));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log info
   */
  info: function () {
    var args = [appendRequest(this.INFO_PRE)];
    args = args.concat(Array.prototype.slice.call(arguments));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log error
   */
  error: function () {
    var args = [appendRequest(this.ERR_PRE)];
    args = args.concat(Array.prototype.slice.call(arguments));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Notify error through email
   */
  notify: function (code, msg, data, backtrace) {
    var args = [appendRequest(this.NOTE_PRE)];
    args = args.concat(Array.prototype.slice.call(arguments));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);

    var fromEmail = null;

    if(environment == 'production') {
      if (subEnvironment == 'main') {
        fromEmail = 'notifier@ost.com';
      } else {
        fromEmail = 'sandbox.notifier@ost.com';
      }
    } else {
      fromEmail = 'staging.notifier@ost.com';
    }

    openSTNotification.publishEvent.perform(
      {
        topics:["email_error."+packageName],
        publisher: 'OST',
        message: {
          kind: "email",
          payload: {
            from: fromEmail,
            to: 'backend@ost.com',
            subject: packageName + " :: " + coreConstants.ENVIRONMENT  + " - "  + coreConstants.SUB_ENVIRONMENT + "::" + code,
            body: " Message: " + msg + " \n Data: " + data + " \n backtrace: " + backtrace
          }
        }
      })
  },

  /**
   * Log warn
   */
  warn: function () {
    var args = [appendRequest(this.WARN_PRE)];
    args = args.concat(Array.prototype.slice.call(arguments));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log win - on done
   */
  win: function () {
    var args = [appendRequest(this.WIN_PRE)];
    args = args.concat(Array.prototype.slice.call(arguments));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log normal level
   */
  log: function () {
    var args = [appendRequest(this.LOG_PRE)];
    args = args.concat(Array.prototype.slice.call(arguments));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log level debug
   */
  debug: function () {
    var args = [appendRequest(this.DEBUG_PRE)];
    args = args.concat(Array.prototype.slice.call(arguments));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  //Method to Log Request Started.
  requestStartLog: function (requestUrl, requestType) {
    const oThis = this
      , d = new Date()
      , dateTime = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() + " " + d.getHours() + ":" +
      d.getMinutes() + ":" + d.getSeconds() + "." + d.getMilliseconds()
      , message = 'Started \'' + requestType + '\'  \'' + requestUrl + '\' at ' + dateTime
    ;

    oThis.info(message);
  },

  //Method to Log Request Completed.
  requestCompleteLog: function (status) {
    const oThis = this
      , message = 'Completed \'' + status + '\' in ' + calculateRequestTime() + 'ms'
    ;

    oThis.info(message);
  }

};

module.exports = new CustomConsoleLoggerKlass();
