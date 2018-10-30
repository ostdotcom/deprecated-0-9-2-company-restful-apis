'use strict';

const rootPrefix = '..',
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  CronProcessesModel = require(rootPrefix + '/app/models/cron_processes'),
  CronProcessesConstants = require(rootPrefix + '/lib/global_constant/cron_processes');

const CronProcessHandler = function(params) {
  const oThis = this;

  oThis.kind = params.kind;
  oThis.cronConfigParams = params.cronConfigParams;
  oThis.ip_address = params.ip_address;

  oThis.cronManager();
};

CronProcessHandler.prototype = {
  cronManager: function() {
    const oThis = this;

    //check whether process with same kind and params already exists

    //if 'running', then throw error - already running

    //else if 'inactive', then TODO:-

    //else if 'stopped', then start normally
  },

  cronPerformer: function() {
    throw 'cronPerformer method should be implemented by the caller for Cron Process Handling';
  }
};

module.exports = CronProcessHandler;
