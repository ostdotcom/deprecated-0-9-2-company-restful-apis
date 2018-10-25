'use strict';
const rootPrefix = '../..';

let coreConstants,
  getNamespace,
  requestNamespace,
  packageName,
  responseHelper,
  ConnectionTimeoutConst,
  logger,
  SharedRabbitMqProvider;

try {
  getNamespace = require('continuation-local-storage').getNamespace;
  requestNamespace = getNamespace('openST-Platform-NameSpace');
  ConnectionTimeoutConst = require(rootPrefix + '/lib/global_constant/connection_timeout');
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification');
  coreConstants = require(rootPrefix + '/config/core_constants');
  packageName = coreConstants.PACKAGE_NAME;
  responseHelper = require(rootPrefix + '/lib/formatter/response');
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');
} catch (e) {
  console.error('Failed to initialize some packages. Some methods may not work. Error:', e);
}

const Email_notifier = function() {};

Email_notifier.prototype = {
  /**
   * Email_notifier error through email
   */
  error: function(code, msg, errData, debugData) {
    const oThis = this;
    const openSTNotification = SharedRabbitMqProvider.getInstance();
    // convert the custom error object to formatted object.
    if (responseHelper.isCustomResult(errData)) {
      let formattedError = errData.toHash();
      formattedError.debug_options = errData.debug_options;

      errData = formattedError;
    }

    logger.error('error_code:', code, 'error_msg:', msg, 'error:', errData, 'debug_data', debugData);

    if (!openSTNotification) {
      logger.warn('Failed to send email. openSTNotification is null');
      return;
    }

    let bodyData = null;

    try {
      bodyData = JSON.stringify(errData);
    } catch (err) {
      bodyData = errData;
    }

    let stringifiedDebugData = null;

    try {
      stringifiedDebugData = JSON.stringify(debugData);
    } catch (err) {
      stringifiedDebugData = debugData;
    }

    let requestId = '';

    if (requestNamespace && requestNamespace.get('reqId')) {
      requestId = requestNamespace.get('reqId');
    }
    const payload = {
      subject:
        `[${coreConstants.ENV_IDENTIFIER}] ` +
        packageName +
        ' :: ' +
        coreConstants.ENVIRONMENT +
        ' - ' +
        coreConstants.SUB_ENVIRONMENT +
        '::' +
        code,
      body:
        ' Request id: ' +
        requestId +
        '\n\n Debug data: ' +
        stringifiedDebugData +
        '\n\n Error message: ' +
        msg +
        ' \n\n Error: ' +
        bodyData
    };

    openSTNotification.publishEvent
      .perform({
        topics: ['email_error.' + packageName],
        publisher: 'OST',
        message: {
          kind: 'email',
          payload: payload
        }
      })
      .catch(function(err) {
        logger.error('Message for airdrop router was not published. Payload: ', payload, ' Error: ', err);
      });
  },

  report: async function(subject, body) {
    const oThis = this,
      openSTNotification = SharedRabbitMqProvider.getInstance();

    if (!openSTNotification) {
      logger.warn('Failed to send email. openSTNotification is null');
      return;
    }

    const payload = {
      subject:
        `[${coreConstants.ENV_IDENTIFIER}] ` +
        packageName +
        ' :: ' +
        coreConstants.ENVIRONMENT +
        ' - ' +
        coreConstants.SUB_ENVIRONMENT +
        '::' +
        subject,
      body: body
    };

    openSTNotification.publishEvent
      .perform({
        topics: ['email_error.' + packageName],
        publisher: 'OST',
        message: {
          kind: 'email',
          payload: payload
        }
      })
      .catch(function(err) {
        logger.error('Message was not published. Payload: ', payload, ' Error: ', err);
      });
  }
};

module.exports = new Email_notifier();
