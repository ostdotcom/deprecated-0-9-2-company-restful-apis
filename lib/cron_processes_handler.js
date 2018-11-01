'use strict';

/**
 * Cron process handler base class.
 *
 * @module /lib/cron_processes_handler
 */

const rootPrefix = '..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  CronProcessesModel = require(rootPrefix + '/app/models/cron_processes'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes');

// Constructor
const CronProcessHandler = function() {};

CronProcessHandler.prototype = {
  /**
   * This function validates whether the cron can be started or not.
   *
   * @param {Object} params
   * @param {Number} params.id
   * @param {String} params.cron_kind
   * @returns {Promise<*>}
   */
  canStartProcess: async function(params) {
    const id = params.id,
      kind = params.cron_kind;

    // Type validations.
    if (typeof id !== 'number') {
      throw 'id is not a number';
    }
    if (typeof kind !== 'string') {
      throw 'kind is not a string.';
    }

    let invertedKind = CronProcessesConstants.invertedKinds[kind],
      runningStatus = CronProcessesConstants.runningStatus,
      last_start_time = new Date().toLocaleString(),
      validationResponse = await new CronProcessesModel()
        .select(['status'])
        .where({ id: id, kind: invertedKind })
        .fire();

    // Checks whether process with same kind and id already exists.

    // If status != stopped throw error as process cannot be started.
    if (
      validationResponse[0].status !== +CronProcessesConstants.invertedStatuses[CronProcessesConstants.stoppedStatus]
      // Implicit string to int conversion.
    ) {
      logger.error(
        'Can not start the cron as the status of the cron is: ',
        CronProcessesConstants.statuses[validationResponse[0].status]
      );
      process.exit(1);
    }
    // Validations done.

    // Define cron_process updateParams.
    let updateParams = {
        id: id,
        kind: kind,
        new_last_start_time: last_start_time,
        new_status: runningStatus
      },
      cronProcessesResponse = await new CronProcessesModel().updateLastStartTimeAndStatus(updateParams);
    // Update entry in cron_processes table

    if (cronProcessesResponse.affectedRows === 1) {
      return Promise.resolve(responseHelper.successWithData({ id: id }));
    } else {
      return Promise.reject({});
    }
  },

  /**
   * Stops process and updates relevant fields in cron_processes.
   *
   * @param {Number} id
   * @returns {Promise<void>}
   */
  stopProcess: async function(id) {
    let params = {
      id: id,
      new_last_end_time: new Date().toLocaleString(),
      new_status: CronProcessesConstants.stoppedStatus
    };

    await new CronProcessesModel().updateLastEndTimeAndStatus(params);
  },

  /**
   * Ends after certain time as passed in params.
   *
   * @param {Object} params
   * @param {Number} params.time_in_minutes
   */
  endAfterTime: function(params) {
    const timeInMinutes = params.time_in_minutes * 60;

    setInterval(function() {
      logger.info('ending the process');
      process.emit('SIGINT');
    }, timeInMinutes * 1000);
  }
};

module.exports = CronProcessHandler;
