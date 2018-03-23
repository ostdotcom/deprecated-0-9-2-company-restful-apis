"use strict";

const rootPrefix = '../..'
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
    , ModelBaseKlass = require(rootPrefix + '/app/models/base')
    , clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id')
    , bitWiseHelperKlass = require(rootPrefix + '/helpers/bitwise_operations')
    , util = require(rootPrefix + '/lib/util')
;

const dbName = "saas_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
    , QueryDBObj = new QueryDBKlass(dbName)
    , statuses = {'1': clientWorkerManagedAddressConst.activeStatus, '2': clientWorkerManagedAddressConst.inactiveStatus}
    , invertedStatuses = util.invert(statuses)
    , properties = {
      1: clientWorkerManagedAddressConst.hasStPrimeBalanceProperty,
    }
    , invertedProperties = util.invert(properties)
;

const ClientWorkerManagedAddressIdsKlass = function () {

  const oThis = this;

  bitWiseHelperKlass.call(this);
  ModelBaseKlass.call(this, {dbName: dbName});

};

ClientWorkerManagedAddressIdsKlass.prototype = Object.create(ModelBaseKlass.prototype);
Object.assign(ClientWorkerManagedAddressIdsKlass.prototype, bitWiseHelperKlass.prototype);

/*
 * Public methods
 */
const ClientWorkerManagedAddressIdsKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'client_worker_managed_address_ids',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  properties: properties,

  invertedProperties: invertedProperties,

  enums: {
    'status': {
      val: statuses,
      inverted: invertedStatuses
    }
  },

  getByClientId: function(client_id){
    const oThis = this;
    return oThis.QueryDB.read(
        oThis.tableName,
        ['id', 'client_id', 'managed_address_id', 'status', 'properties'],
        "client_id=?",
        [client_id]
    );
  },

  getActiveByClientId: async function(client_id){

    const oThis = this
        , activeDbRecords = []
        , dbRecords = await oThis.getByClientId(client_id)
        , activeStatus = oThis.invertedStatuses[clientWorkerManagedAddressConst.activeStatus];

    for(var i=0; i<dbRecords.length; i++) {
      if (dbRecords[i].status == activeStatus) {
        activeDbRecords.push(dbRecords[i]);
      }
    }

    return activeDbRecords;

  },

  getInActiveByClientId: async function(client_id){

    const oThis = this
        , inActiveDbRecords = []
        , dbRecords = await oThis.getByClientId(client_id)
        , inactiveStatus = oThis.invertedStatuses[clientWorkerManagedAddressConst.inactiveStatus];

    for(var i=0; i<dbRecords.length; i++) {
      if (dbRecords[i].status == inactiveStatus) {
        inActiveDbRecords.push(dbRecords[i]);
      }
    }

    return inActiveDbRecords;

  },

  getActiveHavingBalanceByClientId: async function(client_id){

    const oThis = this
        , recordsToReturn = []
        , dbRecords = await oThis.getByClientId(client_id)
        , activeStatus = oThis.invertedStatuses[clientWorkerManagedAddressConst.activeStatus];

    var dbRecord = null;

    for(var i=0; i<dbRecords.length; i++) {
      dbRecord = dbRecords[i]
      if (dbRecord.status == activeStatus && oThis.isBitSet(clientWorkerManagedAddressConst.hasStPrimeBalanceProperty, dbRecord.properties)) {
        recordsToReturn.push(dbRecord);
      }
    }

    return recordsToReturn;

  },

  /**
   * Set all BitWise columns as hash
   * key would be column name and value would be hash of all bitwise values
   *
   * @return {{}}
   */
  setBitColumns: function () {
    const oThis = this;
    oThis.bitColumns = {'properties': invertedProperties};
    return oThis.bitColumns;
  }

};

Object.assign(ClientWorkerManagedAddressIdsKlass.prototype, ClientWorkerManagedAddressIdsKlassPrototype);

module.exports = ClientWorkerManagedAddressIdsKlass;