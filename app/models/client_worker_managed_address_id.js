'use strict';

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id'),
  bitWiseHelperKlass = require(rootPrefix + '/helpers/bitwise_operations'),
  util = require(rootPrefix + '/lib/util');

const dbName = 'saas_client_economy_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT,
  statuses = {
    '1': clientWorkerManagedAddressConst.activeStatus,
    '2': clientWorkerManagedAddressConst.inactiveStatus,
    '3': clientWorkerManagedAddressConst.holdStatus,
    '4': clientWorkerManagedAddressConst.blockingStatus
  },
  invertedStatuses = util.invert(statuses),
  properties = {
    1: clientWorkerManagedAddressConst.hasStPrimeBalanceProperty
  },
  invertedProperties = util.invert(properties);

const ClientWorkerManagedAddressIdModel = function() {
  bitWiseHelperKlass.call(this);
  ModelBaseKlass.call(this, { dbName: dbName });
};

ClientWorkerManagedAddressIdModel.prototype = Object.create(ModelBaseKlass.prototype);
Object.assign(ClientWorkerManagedAddressIdModel.prototype, bitWiseHelperKlass.prototype);

/*
 * Public methods
 */
const ClientWorkerManagedAddressIdModelSpecificPrototype = {
  tableName: 'client_worker_managed_address_ids',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  properties: properties,

  invertedProperties: invertedProperties,

  enums: {
    status: {
      val: statuses,
      inverted: invertedStatuses
    }
  },

  /**
   * Get details based on the clientId
   *
   * @param client_id
   * @returns {Promise<Array>}
   */
  getByClientId: function(client_id) {
    const oThis = this;
    return oThis
      .select('id, process_id, client_id, managed_address_id, status, properties')
      .where(['client_id=?', client_id])
      .fire();
  },

  /**
   * Get details based on the clientId
   *
   * @param client_ids
   * @returns {Promise<Array>}
   */
  getByClientIds: async function(client_ids) {
    const oThis = this,
      clientWorkersMap = {},
      clientAvailableWorkers = await oThis
        .select('id, process_id, client_id, managed_address_id, status, properties')
        .where(['client_id=?', client_id])
        .fire();
  },

  /**
   * Get workers whose status is on hold
   * @param client_id
   * @returns {Promise<Array>}
   */
  getHoldByClientId: function(client_id) {
    const oThis = this,
      holdStatus = +oThis.invertedStatuses[clientWorkerManagedAddressConst.holdStatus]; // Implicit string to int conversion
    return oThis
      .select('id, process_id, client_id, managed_address_id, status, properties')
      .where(['client_id=? AND status=?', client_id, holdStatus])
      .fire();
  },

  /*
  * Get workers which are not associated with any process and has gas as well.
  * @param client_id
  * @returns {Promise<Object>}
  * */
  getAvailableByClientIds: async function(client_ids) {
    const oThis = this,
      clientAvailableWorkersMap = {},
      clientAvailableWorkers = await oThis
        .select('id, process_id, client_id, managed_address_id, status, properties')
        .where([
          'client_id in (?) AND status=? AND properties = properties | ? AND process_id IS NULL',
          client_ids,
          invertedStatuses[clientWorkerManagedAddressConst.activeStatus],
          invertedProperties[clientWorkerManagedAddressConst.hasStPrimeBalanceProperty]
        ])
        .fire();

    for (let i = 0; i < clientAvailableWorkers.length; i++) {
      let clientAvailableWorker = clientAvailableWorkers[i];
      clientAvailableWorkersMap[clientAvailableWorker.client_id] =
        clientAvailableWorkersMap[clientAvailableWorker.client_id] || [];

      clientAvailableWorkersMap[clientAvailableWorker.client_id].push(clientAvailableWorker);
    }
    return Promise.resolve(clientAvailableWorkersMap);
  },

  /**
   * Get details based on the processId
   *
   * @param process_id
   * @returns {Promise<Array>}
   */
  getByProcessId: async function(process_id) {
    const oThis = this;
    return oThis
      .select('id, process_id, client_id, managed_address_id, status, properties')
      .where(['process_id=?', process_id])
      .fire();
  },

  /**
   * Get all the active workers for a particular client.
   *
   * @param client_id
   * @returns {Promise<Array>}
   */
  getActiveByClientId: async function(client_id) {
    const oThis = this,
      activeDbRecords = [],
      dbRecords = await oThis.getByClientId(client_id),
      activeStatus = +oThis.invertedStatuses[clientWorkerManagedAddressConst.activeStatus]; // Implicit string to int conversion

    for (let i = 0; i < dbRecords.length; i++) {
      if (dbRecords[i].status === activeStatus) {
        activeDbRecords.push(dbRecords[i]);
      }
    }

    return activeDbRecords;
  },

  /**
   * Get all the blocking workers for a particular client.
   *
   * @param client_id
   * @returns {Promise<Array>}
   */
  getBlockingByClientId: async function(client_id) {
    const oThis = this,
      blockingDbRecords = [],
      dbRecords = await oThis.getByClientId(client_id),
      blockingStatus = +oThis.invertedStatuses[clientWorkerManagedAddressConst.blockingStatus]; // Implicit string to int conversion

    for (let i = 0; i < dbRecords.length; i++) {
      if (dbRecords[i].status === blockingStatus) {
        blockingDbRecords.push(dbRecords[i]);
      }
    }

    return blockingDbRecords;
  },

  /**
   * Get all the working workers for a particular client. Any worker which has a process associated with it is
   * considered as a working worker.
   *
   * @param client_id
   * @returns {Promise<Array>}
   */
  getWorkingByClientId: async function(client_id) {
    const oThis = this;

    return await oThis
      .select('*')
      .where(['client_id=? AND process_id IS NOT NULL', client_id])
      .fire();
  },

  /**
   * Get all the inactive workers for a particular client.
   *
   * @param client_id
   * @returns {Promise<Array>}
   */
  getInActiveByClientId: async function(client_id) {
    const oThis = this,
      inActiveDbRecords = [],
      dbRecords = await oThis.getByClientId(client_id),
      inactiveStatus = +oThis.invertedStatuses[clientWorkerManagedAddressConst.inactiveStatus]; // Implicit string to int conversion;

    for (let i = 0; i < dbRecords.length; i++) {
      if (dbRecords[i].status === inactiveStatus) {
        inActiveDbRecords.push(dbRecords[i]);
      }
    }

    return inActiveDbRecords;
  },

  getActiveHavingBalanceByClientId: async function(client_id) {
    const oThis = this,
      recordsToReturn = [],
      dbRecords = await oThis.getByClientId(client_id),
      activeStatus = +oThis.invertedStatuses[clientWorkerManagedAddressConst.activeStatus]; // Implicit string to int conversion

    let dbRecord = null;

    for (let i = 0; i < dbRecords.length; i++) {
      dbRecord = dbRecords[i];
      if (
        dbRecord.status === activeStatus &&
        oThis.isBitSet(clientWorkerManagedAddressConst.hasStPrimeBalanceProperty, dbRecord.properties)
      ) {
        recordsToReturn.push(dbRecord);
      }
    }

    return recordsToReturn;
  },

  /**
   * Get workers with any particular status
   * @param status
   * @returns {Promise<*>}
   *
   */
  getWorkersWithStatus: async function(status) {
    const oThis = this,
      invertedStatus = oThis.invertedStatuses[status];
    return await oThis
      .select('id')
      .where(['status=?', invertedStatus])
      .fire();
  },

  /**
   * Update the processId value for a particular worker.
   *
   * @param params
   *        {number} - params.id: id in table
   *        {number} - params.process_id: new processId value
   * @returns {*}
   */
  updateProcessId: function(params) {
    const oThis = this;

    if (!params.id || !params.process_id) {
      throw 'id and processId are missing.';
    }
    return oThis
      .update({ process_id: params.process_id })
      .where({ id: params.id })
      .fire();
  },

  /**
   * Update processId by processId and ClientId
   * @param params.process_id
   * @param params.client_id
   * @param params.new_process_id
   * @returns {*}
   */
  updateProcessIdByProcessId: function(params) {
    const oThis = this;
    return oThis
      .update(['process_id = ?', params.new_process_id])
      .where(['process_id=(?) AND client_id=?', params.process_id, params.client_id])
      .fire();
  },

  /**
   * Mark Status active for records
   * Active: Working
   * @param ids
   * @returns {*}
   */
  markStatusActive: function(ids) {
    const oThis = this;
    return oThis
      .update(['status = ?', oThis.invertedStatuses[clientWorkerManagedAddressConst.activeStatus]])
      .where(['id IN (?)', ids])
      .fire();
  },

  /**
   * Mark Status inactive for records
   * Inactive: Not working
   *
   */
  markStatusInActive: function(ids) {
    const oThis = this;
    return oThis
      .update(['status = ?', oThis.invertedStatuses[clientWorkerManagedAddressConst.inactiveStatus]])
      .where(['id IN (?)', ids])
      .fire();
  },

  /**
   * Mark Status hold for records
   * Hold: It means we are adding another worker for same client
   *
   */
  markStatusHold: function(ids) {
    const oThis = this;
    return oThis
      .update(['status = ?', oThis.invertedStatuses[clientWorkerManagedAddressConst.holdStatus]])
      .where(['id IN (?)', ids])
      .fire();
  },

  /*
  * Mark Status Available for records
  * Available: Worker is not working currently, but we can use it
  *
  * */
  markStatusInactiveByClientId: function(client_id, process_id) {
    const oThis = this;
    return oThis
      .update(['status = ?', oThis.invertedStatuses[clientWorkerManagedAddressConst.inactiveStatus]])
      .where(['client_id=(?) AND process_id=?', client_id, process_id])
      .fire();
  },
  /**
   * Set all BitWise columns as hash
   * key would be column name and value would be hash of all bitwise values
   *
   * @return {{}}
   */
  setBitColumns: function() {
    const oThis = this;
    oThis.bitColumns = { properties: invertedProperties };
    return oThis.bitColumns;
  }
};

Object.assign(ClientWorkerManagedAddressIdModel.prototype, ClientWorkerManagedAddressIdModelSpecificPrototype);

module.exports = ClientWorkerManagedAddressIdModel;
