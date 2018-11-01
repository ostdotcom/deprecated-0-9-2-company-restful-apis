'use strict';

/**
 * Model to get cron process and its details.
 *
 * @module /app/models/cron_processes
 */

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  cronProcessesConstant = require(rootPrefix + '/lib/global_constant/cron_processes');

const dbName = 'saas_config_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT;

const CronProcessesModel = function() {
  const oThis = this;
  ModelBaseKlass.call(oThis, { dbName: dbName });
};

CronProcessesModel.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const CronProcessInfoModelSpecificPrototype = {
  tableName: 'cron_processes',

  get: function(id) {
    const oThis = this;

    let response = oThis
      .select(['kind', 'ip_address', 'group_id', 'params', 'status', 'last_start_time', 'last_end_time'])
      .where({ id: id })
      .fire();

    return Promise.resolve(response);
  },

  /**
   *
   * @param params
   *        params.kind {string}
   *        params.ip_address {string}
   *        params.group_id {number}
   *        params.params {string}
   *        params.status {string}
   *        params.last_start_time {number}
   *        params.last_end_time {number}
   * @returns {*}
   */
  insertRecord: function(params) {
    const oThis = this;

    if (
      !params.hasOwnProperty('kind') ||
      !params.hasOwnProperty('ip_address') ||
      !params.hasOwnProperty('status') ||
      !params.hasOwnProperty('group_id')
    ) {
      throw 'Mandatory parameters are missing.';
    }

    if (typeof params.kind !== 'string' || typeof params.ip_address !== 'string' || typeof params.status !== 'string') {
      throw TypeError('Insertion parameters are of wrong params types.');
    }
    params.status = cronProcessesConstant.invertedStatuses[params.status];
    params.kind = cronProcessesConstant.invertedKinds[params.kind];

    return oThis.insert(params).fire();
  },

  /**
   *
   * @param params
   * @param params.id {number}
   * @param params.kind {string}
   * @param params.new_last_start_time {string}
   * @param params.new_status {string}
   * @returns {*}
   */
  updateLastStartTimeAndStatus: function(params) {
    const oThis = this;

    if (!params.id || !params.new_last_start_time || !params.new_status || !params.kind) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {id, kind, new_last_start_time, new_status}';
    }
    params.new_status = cronProcessesConstant.invertedStatuses[params.new_status];
    params.kind = cronProcessesConstant.invertedKinds[params.kind];

    return oThis
      .update({ last_start_time: params.new_last_start_time, status: params.new_status })
      .where({ id: params.id })
      .fire();
  },

  /**
   *
   * @param params
   *        params.id {number}
   *        params.new_last_end_time {number}
   *        params.new_status {string}
   * @returns {*}
   */
  updateLastEndTimeAndStatus: function(params) {
    const oThis = this;

    if (!params.id || !params.new_last_end_time || !params.new_status) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {id, new_last_end_time, new_status}';
    }
    params.new_status = cronProcessesConstant.invertedStatuses[params.new_status];

    return oThis
      .update({ last_end_time: params.new_last_end_time, status: params.new_status })
      .where({ id: params.id })
      .fire();
  }
};

Object.assign(CronProcessesModel.prototype, CronProcessInfoModelSpecificPrototype);

module.exports = CronProcessesModel;
