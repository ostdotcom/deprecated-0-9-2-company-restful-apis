'use strict';

const rootPrefix = '..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  CronProcessesModel = require(rootPrefix + '/app/models/cron_processes'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes');

const CronProcessHandler = function(params) {
  const oThis = this;

  oThis.kind = params.kind;
  oThis.cronConfigParams = params.cronConfigParams;
  oThis.ip_address = params.ip_address;
};

CronProcessHandler.prototype = {
  startProcess: async function(id, kind) {
    const oThis = this;

    let invertedKind = CronProcessesConstants.invertedKinds[kind],
      activeStatus = CronProcessesConstants.activeStatus,
      last_start_time = new Date().toLocaleString(),
      validationResponse = await new CronProcessesModel()
        .select(['status'])
        .where({ id: id, kind: invertedKind })
        .fire();
    //check whether process with same kind and params already exists

    // if !stopped throw error as cant start
    if (
      validationResponse[0].status !== CronProcessesConstants.invertedStatuses[CronProcessesConstants.stoppedStatus]
    ) {
      logger.error(
        'Can not start the cron as the status of the cron is: ',
        CronProcessesConstants.invertedStatuses[validationResponse[0].status]
      );
      process.exit(1);
    }

    let updateParams = {
        id: id,
        kind: kind,
        new_last_start_time: last_start_time,
        new_status: activeStatus
      },
      cronProcessesResponse = await new CronProcessesModel().updateLastStartTimeAndStatus(updateParams);

    if (cronProcessesResponse.affectedRows === 1) {
      return Promise.resolve(responseHelper.successWithData({ id: id }));
    } else {
      return Promise.reject({});
    }
  },

  stopProcess: function(id) {
    let params = {
      id: id,
      new_last_end_time: new Date().toLocaleString(),
      new_status: CronProcessesConstants.stoppedStatus
    };
    new CronProcessesModel().updateLastEndTimeAndStatus(params);
  },

  endAfterTime: function(params) {
    const timeInMinutes = params.time_in_minutes * 60;

    setInterval(function() {
      logger.info('ending the process');
      process.emit('SIGINT');
    }, timeInMinutes * 1000);
  }
};

module.exports = CronProcessHandler;
