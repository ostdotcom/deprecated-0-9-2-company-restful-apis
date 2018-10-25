'use strict';

/**
 * //Time interval is in hours
 * This cron is to send final report of the statuses in a given time period.
 * @type {string}
 */

const rootPrefix = '..';

const program = require('commander');

program
  .option('--time-interval <timeInterval>', 'time interval')
  .option('--start-time <startTime>', 'start time')
  .option('--end-time <endTime>', 'end time');

program.on('--help', () => {
  console.log('\n  Example 1:');
  console.log('    node ./executables/transaction_status_reporter.js --time-interval 6 ');
  console.log('\n  Example 2:');
  console.log(
    '    node ./executables/transaction_status_reporter.js --start-time "2018-10-23 9:5:58" --end-time "2018-10-23 23:14:31"'
  );
  console.log('');
  console.log('');
});

program.parse(process.argv);

// Validate and sanitize the commander parameters.
const validateAndSanitize = function() {
  console.log('ip', program.startTime, ' ', program.endTime);
  if (!program.timeInterval && (!program.startTime || !program.endTime)) {
    program.help();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta'),
  transactionMetaConst = require(rootPrefix + '/lib/global_constant/transaction_meta'),
  emailNotifier = require(rootPrefix + '/helpers/notifier/email_notifier'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

const TransactionStatusReporter = function() {
  const oThis = this;
  (oThis.startTime = program.startTime), (oThis.endTime = program.endTime), (oThis.timeInterval = program.timeInterval);

  oThis.criticalStatusesArray = [
    transactionMetaConst.queued,
    transactionMetaConst.processing,
    transactionMetaConst.failed,
    transactionMetaConst.geth_down,
    transactionMetaConst.insufficient_gas,
    transactionMetaConst.nonce_too_low,
    transactionMetaConst.replacement_tx_under_priced
  ];
};

TransactionStatusReporter.prototype = {
  perform: function() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error(`${__filename}::perform::catch`);
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'ob_cdu_4',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  },

  asyncPerform: async function() {
    const oThis = this;

    let timeIntervalData = await oThis._calculateStartAndEndTime();

    let finalReportHash = await oThis._fetchDataFromDB(timeIntervalData);

    await oThis._sendMail(finalReportHash, timeIntervalData);
  },

  _calculateStartAndEndTime: async function() {
    const oThis = this;
    let timeIntervalData = {};

    if (oThis.startTime && oThis.endTime) {
      timeIntervalData.startTime = oThis.startTime;
      timeIntervalData.endTime = oThis.endTime;
      return Promise.resolve(timeIntervalData);
    } else if (oThis.timeInterval) {
      let currentTimeEpoch = new Date().getTime(),
        currentTimeString = oThis._convertFromEpochToLocalTime(currentTimeEpoch),
        startingTimeEpoch = currentTimeEpoch - oThis.timeInterval * 60 * 60 * 1000,
        startingTimeString = oThis._convertFromEpochToLocalTime(startingTimeEpoch);

      timeIntervalData.startTime = startingTimeString;
      timeIntervalData.endTime = currentTimeString;
      return Promise.resolve(timeIntervalData);
    } else {
      logger.error('Input time not proper');
      return Promise.reject();
    }
  },

  _convertFromEpochToLocalTime: function(timeInEpoch) {
    const oThis = this;

    let dateVal = timeInEpoch,
      date = new Date(parseFloat(dateVal)),
      currentTimeStampString =
        date.getFullYear() +
        '-' +
        (date.getMonth() + 1) +
        '-' +
        date.getDate() +
        ' ' +
        date.getHours() +
        ':' +
        date.getMinutes() +
        ':' +
        date.getSeconds();

    return currentTimeStampString;
  },

  _fetchDataFromDB: async function(timeIntervalData) {
    const oThis = this;

    let finalReportHash = {};

    let queryResponse = await new TransactionMetaModel()
      .select('status, count(status)')
      .group_by(['status'])
      .where(['created_at > ? AND created_at <= ?', timeIntervalData.startTime, timeIntervalData.endTime])
      .fire();

    for (let index in queryResponse) {
      let statusInString = transactionMetaConst.statuses[queryResponse[index].status];
      finalReportHash[statusInString] = queryResponse[index]['count(status)'];
    }

    return Promise.resolve(finalReportHash);
  },

  _sendMail: async function(finalReportHash, timeIntervalData) {
    const oThis = this;

    let sendMailFlag = false;

    for (let index in oThis.criticalStatusesArray) {
      if (finalReportHash[oThis.criticalStatusesArray[index]] > 0) {
        sendMailFlag = true;
      }
    }

    if (sendMailFlag) {
      let mailBodyString = `Transaction Report:\nStart Time: ${timeIntervalData.startTime}\nEnd Time: ${
        timeIntervalData.endTime
      }\n`;

      mailBodyString += JSON.stringify(finalReportHash);

      await emailNotifier.report('Tx Meta Report', mailBodyString);
    }
  }
};

module.exports = TransactionStatusReporter;

// perform action
const transactionStatusReporterObj = new TransactionStatusReporter();
transactionStatusReporterObj.perform().then(async function(a) {
  logger.info('Transaction status report last generated at', Date.now());
  setTimeout(function() {
    process.exit(0);
  }, 10000); //To kill the process after 10 seconds expecting that the message was pushed in queue.
});
