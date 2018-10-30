'use strict';

/**
 * Model to get cron process and its details.
 *
 * @module /app/models/cron_processes
 */

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  util = require(rootPrefix + '/lib/util'),
  cronProcessesConstant = require(rootPrefix + '/lib/global_constant/cron_processes');

const dbName = 'saas_config_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT,
  kinds = {
    '1': cronProcessesConstant.executeTxCron,
    '2': cronProcessesConstant.onBoardingCron,
    '3': cronProcessesConstant.factoryCron,
    '4': cronProcessesConstant.gethDownHandlerCron,
    '5': cronProcessesConstant.submittedHandlerCron,
    '6': cronProcessesConstant.queuedHandlerCron
  },
  invertedKinds = util.invert(kinds),
  statuses = {
    '1': cronProcessesConstant.runningStatus,
    '2': cronProcessesConstant.stoppedStatus,
    '3': cronProcessesConstant.inactiveStatus
  },
  invertedStatuses = util.invert(statuses);

const CronProcessInfoModel = function() {
  const oThis = this;
  ModelBaseKlass.call(oThis, { dbName: dbName });
};

CronProcessInfoModel.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const CronProcessInfoModelSpecificPrototype = {
  tableName: 'cron_processes',

  get: function(id) {
    const oThis = this;

    let response = oThis
      .select(['kind, ip_address', 'params', 'status', 'last_start_time', 'last_end_time'])
      .where({ id: id })
      .fire();

    return Promise.resolve(response);
  },

  insertRecord: function(params) {
    const oThis = this;

    if (
      !params.hasOwnProperty('kind') ||
      !params.hasOwnProperty('ip_address') ||
      !params.hasOwnProperty('status') ||
      !params.hasOwnProperty('last_start_time') ||
      !params.hasOwnProperty('last_end_time')
    ) {
      throw 'Mandatory parameters are missing.';
    }

    if (
      typeof params.kind !== 'number' ||
      typeof params.ip_address !== 'string' ||
      typeof params.status !== 'number' ||
      typeof params.last_start_time !== 'number' ||
      typeof params.last_end_time !== 'number'
    ) {
      throw TypeError('Insertion parameters are of wrong params types.');
    }
    params.status = oThis.invertedStatuses[params.status];

    return oThis.insert(params).fire();
  },

  updateLastStartTime: function(params) {
    const oThis = this;

    if (!params.id || !params.last_start_time) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {id, last_start_time}';
    }
    return oThis
      .update({ last_start_time: params.last_start_time })
      .where({ id: params.id })
      .fire();
  },

  updateLastEndTime: function(params) {
    const oThis = this;

    if (!params.id || !params.last_end_time) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {id, last_end_time}';
    }
    return oThis
      .update({ last_end_time: params.last_end_time })
      .where({ id: params.id })
      .fire();
  }
};

Object.assign(CronProcessInfoModel.prototype, CronProcessInfoModelSpecificPrototype);

module.exports = CronProcessInfoModel;
