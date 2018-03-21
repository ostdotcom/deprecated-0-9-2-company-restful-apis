"use strict";

const rootPrefix = '../..'
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
    , ModelBaseKlass = require(rootPrefix + '/app/models/base')
    , clientWorkerManagedAddressConst = require(rootPrefix + '/lib/global_constant/client_worker_managed_address_id')
    , util = require(rootPrefix + '/lib/util')
;

const dbName = "saas_client_economy_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
    , QueryDBObj = new QueryDBKlass(dbName)
    , statuses = {'1': clientWorkerManagedAddressConst.activeStatus, '2': clientWorkerManagedAddressConst.inactiveStatus}
    , invertedStatuses = util.invert(statuses)
;

const ClientWorkerManagedAddressIdsKlass = function () {

  const oThis = this;

  ModelBaseKlass.call(this, {dbName: dbName});

};

ClientWorkerManagedAddressIdsKlass.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const ClientWorkerManagedAddressIdsKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'client_worker_managed_address_ids',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

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
        ['client_id', 'managed_address_id'],
        "client_id=?",
        [client_id]
    );
  }

};

Object.assign(ClientWorkerManagedAddressIdsKlass.prototype, ClientWorkerManagedAddressIdsKlassPrototype);

module.exports = ClientWorkerManagedAddressIdsKlass;