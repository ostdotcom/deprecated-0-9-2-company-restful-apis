'use strict';
/**
 * This is script to get error emails from RabbitMQ. Aggregate them and send emails.
 *
 * Usage: node executables/rmq_subscribers/send_error_emails.js
 *
 * @module executables/rmq_subscribers/send_error_emails
 */

// Include Process Locker File
const rootPrefix = '../..',
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  ProcessLocker = new ProcessLockerKlass();

ProcessLocker.canStartProcess({ process_title: 'executables_rmq_subscribers_send_error_emails' });
ProcessLocker.endAfterTime({ time_in_minutes: 60 });

// All Module Requires.
const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  applicationMailerKlass = require(rootPrefix + '/lib/application_mailer'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  applicationMailer = new applicationMailerKlass();

// Global variable defined for email aggregation
global.emailsAggregator = {};

// Declare variables.
let waitingForEmail = false;

const subscribeForErrorEmail = async function() {
  const openStNotification = await SharedRabbitMqProvider.getInstance();

  openStNotification.subscribeEvent
    .rabbit(['email_error.#'], { queue: 'send_error_email_from_restful_apis' }, function(msgContent) {
      msgContent = JSON.parse(msgContent);
      logger.debug('Consumed error message -> ', msgContent);

      const emailPayload = msgContent.message.payload;
      let emailSubject = emailPayload.subject;

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
        setTimeout(function() {
          sendAggregatedEmail();
          waitingForEmail = false;
        }, 30000);
      }
    })
    .catch(function(err) {
      logger.error('Error in subscription. ', err);
      ostRmqError(err);
    });
};

/**
 * Send Emails Aggregated by subject
 *
 */
function sendAggregatedEmail() {
  logger.info('Sending Aggregated Emails');
  const send_for_email = JSON.parse(JSON.stringify(global.emailsAggregator));
  global.emailsAggregator = {};

  for (let subject in send_for_email) {
    let emailPayload = send_for_email[subject];
    emailPayload.body = 'Total Error Count: ' + emailPayload.count + '\n' + emailPayload.body;
    applicationMailer.perform(emailPayload);
  }
}

// Using a single function to handle multiple signals
function handle() {
  logger.info('Received Signal');
  const f = function() {
    sendAggregatedEmail();
    process.exit(1);
  };
  setTimeout(f, 1000);
}

function ostRmqError(err) {
  logger.info('ostRmqError occured.', err);
  process.emit('SIGINT');
}

// Handling graceful process exit on getting SIGINT, SIGTERM.
// Once signal found programme will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);
process.on('ost_rmq_error', ostRmqError);

subscribeForErrorEmail();
