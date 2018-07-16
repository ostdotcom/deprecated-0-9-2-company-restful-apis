"use strict";

/**
 * Custom console logger
 *
 * @module helpers/custom_console_logger
 */

const myProcess = require('process')
    , pid = String( myProcess.pid )
    , pIdPrexfix = "[" + pid + "]"
;


const rootPrefix = "../..";

var coreConstants
  , getNamespace
  , requestNamespace
  , openSTNotification
  , packageName
  , responseHelper
;

try {
  getNamespace = require('continuation-local-storage').getNamespace;
  requestNamespace = getNamespace('openST-Platform-NameSpace');
  openSTNotification = require('@openstfoundation/openst-notification');
  coreConstants = require(rootPrefix + '/config/core_constants');
  packageName = coreConstants.PACKAGE_NAME;
  responseHelper = require(rootPrefix + '/lib/formatter/response');
} catch( e ) {
  console.error("Failed to initilaize some packages. Some methods may not work. Error:", e);
}


const CONSOLE_RESET = "\x1b[0m"
  , ERR_PRE = "\x1b[31m" //Error. (RED)
  , NOTE_PRE = "\x1b[91m" //Notify Error. (Purple)
  , INFO_PRE = "\x1b[35m" //Info (Magenta)
  , WIN_PRE = "\x1b[32m" //Success (GREEN)
  , LOG_PRE = CONSOLE_RESET //Log (Default Console Color)
  , DEBUG_PRE = "\x1b[36m" //Debug log (Cyan)
  , WARN_PRE = "\x1b[43m"
  , STEP_PRE = "\n\x1b[34m"
;

//Other Known Colors
//"\x1b[33m" // (YELLOW)

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
 * Custom Console Logger
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
   * @param {string} message
   */
  step: function () {
    const oThis = this
    ;
  
    var argsPassed = oThis._filterArgs(arguments);
    
    var args  = [oThis.getPrefix( oThis.STEP_PRE )];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(oThis.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log info
   * @param {string} message
   */
  info: function () {
    const oThis = this
    ;
    
    var argsPassed = oThis._filterArgs(arguments);
    
    var args  = [oThis.getPrefix( oThis.INFO_PRE )];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(oThis.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log error
   * @param {string} message
   */
  error: function () {
    const oThis = this
    ;
  
    var argsPassed = oThis._filterArgs(arguments);
    
    var args  = [oThis.getPrefix(oThis.ERR_PRE )];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(oThis.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Notify error through email
   */
  notify: function (code, msg, errData, debugData) {
    const oThis = this
    ;

    // convert the custom error object to formatted object.
    if (responseHelper.isCustomResult(errData)) {
      let formattedError = errData.toHash();
      formattedError.debug_options = errData.debug_options;

      errData = formattedError;
    }

    oThis.error(
      'error_code:', code,
      'error_msg:', msg,
      'error:', errData,
      'debug_data', debugData
    );

    if ( !openSTNotification ) {
      oThis.warn("Failed to send email. openSTNotification is null");
      return;
    }

    var bodyData = null
    ;

    try {
      bodyData = JSON.stringify(errData);
    } catch(err) {
      bodyData = errData;
    }

    var stringifiedDebugData = null
    ;

    try {
      stringifiedDebugData = JSON.stringify(debugData);
    } catch(err) {
      stringifiedDebugData = debugData;
    }

    var requestId = '';

    if (requestNamespace && requestNamespace.get('reqId')){
      requestId = requestNamespace.get('reqId');
    }

    openSTNotification.publishEvent.perform(
      {
        topics:["email_error."+packageName],
        publisher: 'OST',
        message: {
          kind: 'email',
          payload: {
            subject: packageName + " :: " + coreConstants.ENVIRONMENT  + " - "  + coreConstants.SUB_ENVIRONMENT + "::" + code,
            body: " Request id: " + requestId +
                  "\n\n Debug data: " + stringifiedDebugData +
                  "\n\n Error message: " + msg +
                  " \n\n Error: " + bodyData
          }
        }
      })
  },

  /**
   * Log warn
   * @param {string} message
   */
  warn: function () {
    const oThis = this
    ;
  
    var argsPassed = oThis._filterArgs(arguments);
    
    var args  = [oThis.getPrefix( this.WARN_PRE )];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log win - on done
   * @param {string} message
   */
  win: function () {
    const oThis = this
    ;
  
    var argsPassed = oThis._filterArgs(arguments);
    
    var args  = [oThis.getPrefix( this.WIN_PRE )];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log normal level
   * @param {string} message
   */
  log: function () {
    const oThis = this
    ;
  
    var argsPassed = oThis._filterArgs(arguments);
    
    var args  = [oThis.getPrefix( this.LOG_PRE )];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    args.push(this.CONSOLE_RESET);
    console.log.apply(console, args);
  },

  /**
   * Log level debug
   */
  debug: function () {
    if (coreConstants.DEBUG_ENABLED == 1) {
      var oThis = this;

      var argsPassed = Array.prototype.slice.call(arguments);
      for(var i = 0; i < argsPassed.length; i ++) {
        if( argsPassed[i] instanceof Object && !(argsPassed[i] instanceof String) ) {
          argsPassed[i] = JSON.stringify(argsPassed[i]);
        }
      }

      var args = [oThis.getPrefix(this.DEBUG_PRE)];
      args = args.concat(argsPassed);
      args.push(this.CONSOLE_RESET);
      console.log.apply(console, args);
    }
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
  },
  
  /**
   * Log trace
   * @param {string} message
   */
  trace : function () {
    var oThis =  this;
    
    var argsPassed = oThis._filterArgs(arguments);
    
    var args = [oThis.getPrefix( this.ERR_PRE )];
    args = args.concat(Array.prototype.slice.call(argsPassed));
    console.trace.apply(console, args);
    console.log( this.CONSOLE_RESET );
  },
  
  /**
   * Log dir
   * @param {string} message
   */
  dir: function () {
    var oThis = this;
    
    var argPassed = oThis._filterArgs(arguments);
    console.log(oThis.CONSOLE_RESET );
    console.dir.apply(console, argPassed);
    console.log( oThis.CONSOLE_RESET );
  },

  /**
   * Method to append Request in each log line.
   *
   * @param {string} message
   */
  getPrefix : function( prefix ){

    var newMessage = pIdPrexfix;
    if (requestNamespace) {
      if (requestNamespace.get('reqId')) {
        newMessage += "[" + requestNamespace.get('reqId') + "]";
      }
    }

    var hrTime = process.hrtime();
    newMessage += "[" + timeInMilli(hrTime) + "]";


    newMessage += prefix;
    return newMessage;
  },
  
  /**
   * Test logger methods
   *
   * @param {string} message
   */
  testLogger: function () {
    const oThis = this;

    console.log("Testing Basic Methods");
    try {
      oThis.step("step Invoked");
      oThis.info("info Invoked");
      oThis.error("error called");
      oThis.warn("warn called");
      oThis.win("win called");
      oThis.log("log called");
      oThis.debug("debug called");
      oThis.trace("trace called");
    } catch( e ) {
      console.error("Basic Test Failed. Error:\n", e);
      return;
    }
    
    console.log("All Basic Test Passed!");    
  },
  
  /**
   * Pre filter for all the logger methods
   *
   * @param {string} message
   */
  _filterArgs: function(args) {
    var argsPassed = []
      , currArg
      , i
    ;
    for (i = 0; i < args.length; i++) {
      currArg = args[i];
      if (currArg instanceof Object) {
        currArg = JSON.stringify(currArg);
      }
      argsPassed.push(currArg);
    }
    return argsPassed;
  }
};

module.exports = new CustomConsoleLoggerKlass();
