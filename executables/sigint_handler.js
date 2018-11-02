'use strict';

const rootPrefix = '..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  cronProcessHandler = require(rootPrefix + '/lib/cron_processes_handler'),
  cronProcessHandlerObject = new cronProcessHandler();

// Constructor
const SigIntHandler = function(params) {
  const oThis = this;
  oThis.idToBeKilled = params.id;

  oThis.attachHandlers();
};

SigIntHandler.prototype = {
  /**
   * attachHandlers - Attach SIGINT/SIGTERM handlers to the current process
   *
   */
  attachHandlers: function() {
    const oThis = this;

    oThis.pendingTasksDone(); // Throw if the method is not implemented by caller

    let handle = function() {
      if (oThis.pendingTasksDone()) {
        logger.info(':: No pending tasks. Changing the status ');
        cronProcessHandlerObject.stopProcess(oThis.idToBeKilled).then(function() {
          logger.info('Status and last_end_time updated in table. Killing process.');

          // Stop the process only after the entry has been updated in the table.
          process.exit(1);
        });
      }
      logger.info(':: There are pending tasks. Waiting for completion.');
      setTimeout(handle, 1000);
    };

    process.on('SIGINT', handle);
    process.on('SIGTERM', handle);
  },

  /**
   * pendingTasksDone - Provides info whether the process has to exit
   *
   */
  pendingTasksDone: function() {
    throw 'pendingTasksDone method should be implemented by the caller for SIGINT handling';
  }
};

module.exports = SigIntHandler;
