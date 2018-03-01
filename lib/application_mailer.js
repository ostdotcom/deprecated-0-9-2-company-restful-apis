"use strict";

/**
 *
 * Send email from application.<br><br>
 *
 * @module lib/application_mailer
 *
 */

// Load external modules
const applicationMailer = require('nodemailer')
;

//All Module Requires.
const rootPrefix = '..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/**
 * constructor
 *
 * @constructor
 */
const applicationMailerKlass = function () {

  const oThis = this;

};

applicationMailerKlass.prototype = {

  /**
   * Send Email Using Sendmail
   *
   * @param {object} params -
   * @param {string} params.to - send email to
   * @param {string} params.from - send email from
   * @param {string} params.subject - email subject
   * @param {string} params.body - email text body
   *
   * @return {Promise<Result>} - On success, data.value has value. On failure, error details returned.
   */
  perform: function (params) {

    const oThis = this;

    oThis.transporter = applicationMailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: '/usr/sbin/sendmail'
    });

    if (coreConstants.ENVIRONMENT != 'development') {
      oThis.transporter.sendMail(
        {
          from: params.from,
          to: params.to,
          subject: params.subject,
          text: params.body
        }, function (err, info) {
          logger.info("envelope:", info.envelope, "messageId:", info.messageId, "Error:", JSON.stringify(err));
        }
      );
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }

}

module.exports = applicationMailerKlass;
