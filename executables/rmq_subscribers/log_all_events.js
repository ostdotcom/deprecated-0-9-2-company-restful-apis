'use strict';
/**
 * This is script to log all RMQ events in a table.
 *
 * Usage: node executables/rmq_subscribers/log_all_events.js
 *
 * @module executables/rmq_subscribers/factory
 */
/**
 *
 * Log all RMQ events in a table.<br><br>
 *
 * @module executables/rmq_subscribers/log_all_events
 *
 */

// Include Process Locker File
const rootPrefix = '../..',
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  ProcessLocker = new ProcessLockerKlass();

ProcessLocker.canStartProcess({ process_title: 'executables_rmq_subscribers_log_all_events' });
ProcessLocker.endAfterTime({ time_in_minutes: 60 });

// Load external packages
const openSTNotification = require('@openstfoundation/openst-notification');

//All Module Requires.
const EventLogModel = require(rootPrefix + '/app/models/event_logs'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger');

// global variable defined for events aggregation
global.eventsAggregator = [];

var tasksPending = 0;

var waitingForEvents = false;

openSTNotification.subscribeEvent.rabbit(['#'], { queue: 'log_all_events_from_restful_apis' }, function(eventContent) {
  eventContent = JSON.parse(eventContent);
  logger.debug('Consumed event -> ', eventContent);

  global.eventsAggregator.push(eventContent);

  // Wait for 30 sec to aggregate events for bulk insert
  if (!waitingForEvents) {
    waitingForEvents = true;
    setTimeout(function() {
      tasksPending += 1;
      bulkInsertInLog();
      waitingForEvents = false;
    }, 30000);
  }
});

/**
 * Bulk insert In events_log table
 *
 */
var bulkInsertInLog = function() {
  return new Promise(async function(onResolve, onReject) {
    logger.debug('Bulk Insert In Event log table');
    const events = global.eventsAggregator,
      fields = ['kind', 'event_data'];
    global.eventsAggregator = [];

    var sql_rows_array = [];

    for (var i in events) {
      const event = events[i],
        kind = event.message.kind;
      sql_rows_array.push([kind, JSON.stringify(event)]);

      if (sql_rows_array.length >= 2000) {
        await new EventLogModel().insertMultiple(fields, sql_rows_array).fire();
        sql_rows_array = [];
      }
    }

    if (sql_rows_array.length > 0) {
      await new EventLogModel().insertMultiple(fields, sql_rows_array).fire();
      sql_rows_array = [];
    }

    tasksPending = tasksPending - 1;
    onResolve();
  });
};

// Using a single function to handle multiple signals
var handle = function() {
  logger.info('Received Signal');
  var f = async function() {
    if (tasksPending <= 0) {
      await bulkInsertInLog();
      logger.info('Exiting the process now');
      process.exit(1);
    } else {
      setTimeout(f, 1000);
    }
  };
  setTimeout(f, 1000);
};

// handling gracefull process exit on getting SIGINT, SIGTERM.
// Once signal found programme will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);
