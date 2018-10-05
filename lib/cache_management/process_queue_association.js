'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  ClientManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  processQueueAssocConst = require(rootPrefix + '/lib/global_constant/process_queue_association'),
  ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * @constructor
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ProcessQueueAssociationCacheKlass = function(params) {
  const oThis = this;

  oThis.clientId = params['client_id'];
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '1';

  baseCache.call(oThis, params);

  oThis.useObject = true;
};

ProcessQueueAssociationCacheKlass.prototype = Object.create(baseCache.prototype);

const ProcessQueueAssociationKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'p_q_asso_' + oThis.clientId;

    return oThis.cacheKey;
  },

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   *
   * @return {Number}
   */
  setCacheExpiry: function() {
    const oThis = this;

    oThis.cacheExpiry = 86400; // 24 hours

    return oThis.cacheExpiry;
  },

  /**
   * fetch data from source
   *
   * @return {Result}
   */
  fetchDataFromSource: async function() {
    const oThis = this,
      clientWorkerManagedAddressIdRsp = await new ClientWorkerManagedAddressIdModel().getWorkingByClientId(
        oThis.clientId
      );
    // The above method call will fetch processIds for all working workers.

    let workingProcesses = [];

    if (clientWorkerManagedAddressIdRsp.length !== 0) {
      let processIds = [],
        managedAddressIds = [],
        processAndAddressMapping = {};

      for (let i = 0; i < clientWorkerManagedAddressIdRsp.length; i++) {
        processIds.push(clientWorkerManagedAddressIdRsp[i].process_id);
        managedAddressIds.push(clientWorkerManagedAddressIdRsp[i].managed_address_id);
        processAndAddressMapping[clientWorkerManagedAddressIdRsp[i].process_id] =
          clientWorkerManagedAddressIdRsp[i].managed_address_id;
      }
      // (managed_address_id === id) = true
      let workerUuidsArray = await new ClientManagedAddressModel().getUuidById(managedAddressIds),
        workerIdAndUuidMapping = {};

      for (let i = 0; i < workerUuidsArray.length; i++) {
        workerIdAndUuidMapping[workerUuidsArray[i].id] = workerUuidsArray[i].uuid;
      }

      let processDetailsMap = await new ProcessQueueAssociationModel().getByProcessIds(processIds);
      // The above method call will fetch all the details for a process.

      for (let processId in processDetailsMap) {
        let processDetails = processDetailsMap[processId];
        // Pass only those processIds which are not killed.
        if (processDetails.status !== processQueueAssocConst.processKilled) {
          let processRecord = {
            process_id: processDetails.process_id,
            queue_name_suffix: processDetails.queue_name_suffix,
            chain_id: processDetails.chain_id,
            worker_managed_address_id: processAndAddressMapping[processDetails.process_id]
          };

          processRecord['workerUuid'] = workerIdAndUuidMapping[processRecord.worker_managed_address_id];

          // Working processes. If not gold, all are considered to be working.
          workingProcesses.push(processRecord);
        }
      }
    }

    return Promise.resolve(responseHelper.successWithData({ workingProcessDetails: workingProcesses }));
  }
};

Object.assign(ProcessQueueAssociationCacheKlass.prototype, ProcessQueueAssociationKlassPrototype);

InstanceComposer.registerShadowableClass(ProcessQueueAssociationCacheKlass, 'getProcessQueueAssociationCache');

module.exports = ProcessQueueAssociationCacheKlass;
