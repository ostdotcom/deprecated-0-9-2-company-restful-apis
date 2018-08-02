'use strict';

const rootPrefix = '../..',
  baseCache = require(rootPrefix + '/lib/cache_management/base'),
  ClientWorkerManagedAddressIdModel = require(rootPrefix + '/app/models/client_worker_managed_address_id'),
  ManagedAddressModel = require(rootPrefix + '/app/models/managed_address'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  cacheManagementConst = require(rootPrefix + '/lib/global_constant/cache_management'),
  InstanceComposer = require(rootPrefix + '/instance_composer');

/**
 * @constructor
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const ClientActiveWorkerUuidCacheKlass = function(params) {
  const oThis = this;

  oThis.clientId = params['client_id'];
  oThis.cacheType = cacheManagementConst.memcached;
  oThis.consistentBehavior = '0';

  baseCache.call(oThis, params);

  oThis.useObject = true;
};

ClientActiveWorkerUuidCacheKlass.prototype = Object.create(baseCache.prototype);

const ClientActiveWorkerUuidKlassPrototype = {
  /**
   * set cache key
   *
   * @return {String}
   */
  setCacheKey: function() {
    const oThis = this;

    oThis.cacheKey = oThis._cacheKeyPrefix() + 'c_ac_wrke_' + oThis.clientId;

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
      workerManagedAddresses = await new ClientWorkerManagedAddressIdModel().getActiveHavingBalanceByClientId(
        oThis.clientId
      );

    let workerManagedAddressIds = [],
      workerUuids = [];

    for (let i = 0; i < workerManagedAddresses.length; i++) {
      workerManagedAddressIds.push(workerManagedAddresses[i].managed_address_id);
    }

    if (workerManagedAddressIds.length !== 0) {
      const managedAddressData = await new ManagedAddressModel().getByIds(workerManagedAddressIds);
      for (let i = 0; i < managedAddressData.length; i++) {
        workerUuids.push(managedAddressData[i].uuid);
      }
    }

    return Promise.resolve(responseHelper.successWithData({ workerUuids: workerUuids }));
  }
};

Object.assign(ClientActiveWorkerUuidCacheKlass.prototype, ClientActiveWorkerUuidKlassPrototype);

InstanceComposer.registerShadowableClass(ClientActiveWorkerUuidCacheKlass, 'getClientActiveWorkerUuidCache');

module.exports = ClientActiveWorkerUuidCacheKlass;
