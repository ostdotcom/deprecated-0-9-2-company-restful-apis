'use strict';

/**
 * Model to get process and queue association details.
 *
 * @module /app/models/process_queue_association
 */

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  processQueueAssocConst = require(rootPrefix + '/lib/global_constant/process_queue_association'),
  util = require(rootPrefix + '/lib/util');

const dbName = 'saas_config_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT,
  statuses = {
    '1': processQueueAssocConst.availableForAllocations,
    '2': processQueueAssocConst.dedicated,
    '3': processQueueAssocConst.full,
    '4': processQueueAssocConst.processKilled
  },
  invertedStatuses = util.invert(statuses);

const ProcessQueueAssociation = function() {
  const oThis = this;

  ModelBaseKlass.call(oThis, { dbName: dbName });
};

ProcessQueueAssociation.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const ProcessQueueAssociationModelSpecificPrototype = {
  tableName: 'process_queue_association',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  /**
   * Get details using the id.
   *
   * @param id
   * @return {*}
   *
   */
  getById: async function(id) {
    const oThis = this;

    let response = await oThis
      .select(['process_id', 'rmq_config_id', 'queue_name_suffix', 'status'])
      .where({ id: id })
      .fire();

    response[0].status = oThis.statuses[response[0].status];

    return Promise.resolve(response);
  },

  /**
   * Get details for multiple ids.
   *
   * @param ids
   * @return {*}
   *
   */
  getByIds: async function(ids) {
    const oThis = this;

    let response = await oThis
      .select(['process_id', 'rmq_config_id', 'queue_name_suffix', 'status'])
      .where(['id IN (?)', ids])
      .fire();

    for (let i = 0; i < response.length; i++) {
      response[i].status = oThis.statuses[response[i].status];
    }
    return Promise.resolve(response);
  },

  /**
   * Get details using the processId.
   *
   * @param processId
   * @return {*}
   *
   */
  getByProcessId: async function(processId) {
    const oThis = this;

    let response = await oThis
      .select(['process_id', 'rmq_config_id', 'queue_name_suffix', 'status'])
      .where({ process_id: processId })
      .fire();

    const processQueueData = response[0];
    processQueueData.status = oThis.statuses[processQueueData.status];

    return Promise.resolve(processQueueData);
  },

  /**
   * Get details for multiple processIds.
   *
   * @param processIds
   * @return {Promise<Object>}
   *
   */
  getByProcessIds: async function(processIds) {
    const oThis = this,
      processDetailsMap = {};

    let response = await oThis
      .select(['process_id', 'rmq_config_id', 'queue_name_suffix', 'status'])
      .where(['process_id IN (?)', processIds])
      .fire();

    for (let i = 0; i < response.length; i++) {
      response[i].status = oThis.statuses[response[i].status];
      processDetailsMap[response[i].process_id] = response[i];
    }
    return Promise.resolve(processDetailsMap);
  },

  /**
   * Get details using the rmqId.
   *
   * @param rmqId
   * @return {*}
   *
   */
  getByRmqId: async function(rmqId) {
    const oThis = this;

    let response = await oThis
      .select(['process_id', 'rmq_config_id', 'queue_name_suffix', 'status'])
      .where({ rmq_config_id: rmqId })
      .fire();

    response[0].status = oThis.statuses[response[0].status];

    return Promise.resolve(response);
  },

  /**
   * Get details for multiple rmqIds.
   *
   * @param rmqIds
   * @return {*}
   *
   */
  getByRmqIds: async function(rmqIds) {
    const oThis = this;

    let response = await oThis
      .select(['process_id', 'rmq_config_id', 'queue_name_suffix', 'status'])
      .where(['rmq_config_id IN (?)', rmqIds])
      .fire();

    for (let i = 0; i < response.length; i++) {
      response[i].status = oThis.statuses[response[i].status];
    }
    return Promise.resolve(response);
  },

  /**
   * Get details using the topicName.
   *
   * @param topicName
   * @return {*}
   *
   */
  getByTopicName: async function(topicName) {
    const oThis = this;

    let response = await oThis
      .select(['process_id', 'rmq_config_id', 'queue_name_suffix', 'status'])
      .where({ queue_name_suffix: topicName })
      .fire();

    response[0].status = oThis.statuses[response[0].status];

    return Promise.resolve(response);
  },

  /**
   * Get details for multiple topicNames.
   *
   * @param topicNames
   * @return {*}
   *
   */
  getByTopicNames: async function(topicNames) {
    const oThis = this;

    let response = await oThis
      .select(['process_id', 'rmq_config_id', 'queue_name_suffix', 'status'])
      .where(['queue_name_suffix IN (?)', topicNames])
      .fire();

    for (let i = 0; i < response.length; i++) {
      response[i].status = oThis.statuses[response[i].status];
    }
    return Promise.resolve(response);
  },

  /**
   * Get processes with any particular status
   *
   * @param status
   * @returns {Promise<*>}
   *
   */
  getProcessesByStatus: async function(status) {
    const oThis = this,
      invertedStatus = oThis.invertedStatuses[status];
    return await oThis
      .select('process_id')
      .where(['status=?', invertedStatus])
      .fire();
  },

  /**
   * Add a record in the table.
   *
   * @param params
   *        {number} - params.process_id: processId to be added.
   *        {number} - params.rmq_config_id: rmqId to be added.
   *        {string} - params.queue_name_suffix: topicName to be added.
   *        {string} - params.status: status to be added.
   * @return {*}
   *
   */
  insertRecord: function(params) {
    const oThis = this;

    if (!params.process_id || !params.hasOwnProperty('rmq_config_id') || !params.queue_name_suffix || !params.status) {
      throw 'Mandatory parameters are missing.';
    }

    if (
      typeof params.process_id !== 'number' ||
      typeof params.rmq_config_id !== 'number' ||
      typeof params.queue_name_suffix !== 'string' ||
      typeof params.status !== 'string'
    ) {
      throw TypeError('Insertion parameters are of wrong params types.');
    }

    params.status = oThis.invertedStatuses[params.status];

    return oThis.insert(params).fire();
  },

  /**
   * Update an entry using the id.
   *
   * @param params
   *        {number} - params.id: Id for which record is to be updated.
   *        {number} - params.new_process_id: new processId value.
   *        {number} - params.new_rmq_id: new rmqId value.
   *        {string} - params.new_topic_name: new topicName.
   *        {string} - params.new_status: new status
   * @return {*}
   */
  updateUsingId: function(params) {
    const oThis = this;

    if (!params.id || !params.new_process_id || !params.new_rmq_id || !params.new_topic_name || !params.new_status) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {id, new_process_id, new_rmq_id, new_topic_name, new_status}';
    }

    if (
      typeof params.new_process_id !== 'number' ||
      typeof params.new_rmq_id !== 'number' ||
      typeof params.new_topic_name !== 'string' ||
      typeof params.new_status !== 'string'
    ) {
      throw 'Insertion parameter are of wrong data types.';
    }

    params.new_status = oThis.invertedStatuses[params.new_status];

    return oThis
      .update({
        process_id: params.new_process_id,
        rmq_config_id: params.new_rmq_id,
        queue_name_suffix: params.new_topic_name,
        status: params.new_status
      })
      .where({
        id: params.id
      })
      .fire();
  },

  /**
   * Update an entry using the processId.
   *
   * @param params
   *        {number} - params.process_id: processId for which record is to be updated.
   *        {number} - params.new_rmq_id: new rmqId value.
   *        {string} - params.new_topic_name: new topicName.
   *        {string} - params.new_status: new status
   * @return {*}
   */
  updateUsingProcessId: function(params) {
    const oThis = this;

    if (!params.new_rmq_id || !params.new_topic_name || !params.new_status) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {new_rmq_id, new_topic_name, new_status}';
    }

    if (
      typeof params.new_rmq_id !== 'number' ||
      typeof params.new_topic_name !== 'string' ||
      typeof params.new_status !== 'string'
    ) {
      throw 'Insertion parameter are of wrong data types.';
    }

    params.new_status = oThis.invertedStatuses[params.new_status];

    return oThis
      .update({
        rmq_config_id: params.new_rmq_id,
        queue_name_suffix: params.new_topic_name,
        status: params.new_status
      })
      .where({
        process_id: params.process_id
      })
      .fire();
  },

  /**
   * Update a process status entry using the processId.
   *
   * @param params
   *        {number} - params.process_id: processId for which record is to be updated.
   *        {string} - params.new_status: new process status value.
   * @return {*}
   */
  updateProcessStatusUsingProcessId: function(params) {
    const oThis = this;

    if (!params.process_id || !params.new_status) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {process_id, new_status}';
    }

    if (typeof params.new_status !== 'string') {
      throw 'new_status should be a string.';
    }

    params.new_status = oThis.invertedStatuses[params.new_status];

    return oThis
      .update({ status: params.new_status })
      .where({
        process_id: params.process_id
      })
      .fire();
  },

  /**
   * Update a topicName entry using the processId.
   *
   * @param params
   *        {number} - params.process_id: processId for which record is to be updated.
   *        {string} - params.new_topic_name: new topicName value.
   * @return {*}
   */
  updateTopicNameUsingProcessId: function(params) {
    const oThis = this;

    if (!params.process_id || !params.new_topic_name) {
      throw 'Mandatory parameters are missing. Expected an object with the following keys: {process_id, new_topic_name}';
    }

    if (typeof params.new_topic_name !== 'string') {
      throw 'new_status should be a string.';
    }

    return oThis
      .update({ queue_name_suffix: params.new_topic_name })
      .where({
        process_id: params.process_id
      })
      .fire();
  },

  /**
   * Deletes a record using the Id.
   *
   * @param params
   *        {number} - params.id: Id for which record is to be deleted.
   * @return {*}
   *
   */
  deleteById: function(params) {
    const oThis = this;

    if (!params.id) {
      throw 'id is missing.';
    }

    return oThis
      .delete()
      .where({
        id: params.id
      })
      .fire();
  },

  /**
   * Deletes a record using the processId.
   *
   * @param params
   *        {number} - params.process_id: processId for which record is to be deleted.
   * @return {*}
   *
   */
  deleteByProcessId: function(params) {
    const oThis = this;

    if (!params.process_id) {
      throw 'process_id is missing.';
    }

    return oThis
      .delete()
      .where({
        process_id: params.process_id
      })
      .fire();
  }
};

Object.assign(ProcessQueueAssociation.prototype, ProcessQueueAssociationModelSpecificPrototype);

module.exports = ProcessQueueAssociation;
