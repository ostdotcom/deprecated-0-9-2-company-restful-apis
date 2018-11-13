'use strict';
/**
 * This is script to get error emails from RabbitMQ. Aggregate them and send emails.
 *
 * Usage: node executables/rmq_subscribers/send_error_emails.js processLockId
 * processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.
 *
 * @module executables/rmq_subscribers/send_error_emails
 */

// Include Process Locker File
const rootPrefix = '../..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  applicationMailerKlass = require(rootPrefix + '/lib/application_mailer'),
  CronProcessesHandler = require(rootPrefix + '/lib/cron_processes_handler'),
  SharedRabbitMqProvider = require(rootPrefix + '/lib/providers/shared_notification'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes'),
  applicationMailer = new applicationMailerKlass(),
  CronProcessHandlerObject = new CronProcessesHandler();

const usageDemo = function() {
  logger.log('Usage:', 'node executables/update_realtime_gas_price.js processLockId');
  logger.log(
    '* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.'
  );
};

// Declare variables.
const args = process.argv,
  processLockId = args[2],
  cronKind = CronProcessesConstants.sendErrorEmails;

// Validate and sanitize the command line arguments.
if (!processLockId) {
  logger.error('Process Lock id NOT passed in the arguments.');
  usageDemo();
  process.exit(1);
}

// Check whether the cron can be started or not.
CronProcessHandlerObject.canStartProcess({
  id: +processLockId, // Implicit string to int conversion
  cron_kind: cronKind
});

CronProcessHandlerObject.endAfterTime({ time_in_minutes: 60 });

// Global variable defined for email aggregation
global.emailsAggregator = {};

// Declare variables.
let waitingForEmail = false;

const subscribeForErrorEmail = async function() {
  const openStNotification = await SharedRabbitMqProvider.getInstance();

  openStNotification.subscribeEvent.rabbit(['email_error.#'], { queue: 'send_error_email_from_restful_apis' }, function(
    msgContent
  ) {
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
    CronProcessHandlerObject.stopProcess(processLockId).then(function() {
      logger.info('Status and last_end_time updated in table. Killing process.');
      // Stop the process only after the entry has been updated in the table.
      process.exit(1);
    });
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
