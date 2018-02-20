"use strict";

/**
 *
 * Get Error Emails from RabbitMQ. Aggregate them and send emails .<br><br>
 *
 * @module executables/send_error_emails
 *
 */

// Load external packages
const openSTNotification = require('@openstfoundation/openst-notification')
;

//All Module Requires.
const rootPrefix = '..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , applicationMailerKlass = require(rootPrefix + '/lib/application_mailer')
  , applicationMailer = new applicationMailerKlass()
;

// global variable defined for email aggregation
global.emailsAggregator = {};

var waitingForEmail = false;

openSTNotification.subscribeEvent.rabbit(["error.#"], {queue: 'send_error_email_from_restful_apis'},
  function (msgContent) {
    msgContent = JSON.parse(msgContent);
    logger.info('Consumed error message -> ', msgContent);

    const emailPayload = msgContent.message.payload;
    var emailSubject = emailPayload.subject;

    // aggregate same errors for a while
    if (global.emailsAggregator[emailSubject]) {
      global.emailsAggregator[emailSubject].count++;
    } else {
      global.emailsAggregator[emailSubject] = emailPayload;
      global.emailsAggregator[emailSubject].count = 1;
    }

    // Wait for 3 sec to aggregate emails with subject line
    if (!waitingForEmail) {
      waitingForEmail = true;
      setTimeout(function () {
        // Get errors and reset it for more errors
        var send_for_email = JSON.parse(JSON.stringify(global.emailsAggregator));
        global.emailsAggregator = {};

        for (var subject in send_for_email) {
          var emailPayload = send_for_email[subject];
          emailPayload.body = "Total Error Count: " + emailPayload.count + "\n" + emailPayload.body;
          applicationMailer.perform(emailPayload);
        }
        waitingForEmail = false;
      }, 30000);

    }
  });