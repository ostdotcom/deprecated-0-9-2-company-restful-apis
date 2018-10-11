'use strict';

const rootPrefix = '..',
  OpenSTCache = require('@openstfoundation/openst-cache'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  ConfigStrategyHelperKlass = require(rootPrefix + '/helpers/config_strategy');

require(rootPrefix + '/lib/cache_management/process_queue_association');
require(rootPrefix + '/lib/cache_management/client_active_worker_uuid');

/**
 *
 * @constructor
 */
const RmqQueueHelperKlass = function() {};

RmqQueueHelperKlass.prototype = {
  /**
   * Clear processQueueAssociation and clientActiveWorkerUuid cache for the passed clientId.
   *
   * @param clientId {number}: client for which cache is supposed to be cleared.
   * @returns {Promise<void>}
   *
   */
  clearProcessRelatedCache: async function(clientId) {
    const oThis = this;
    // Fetch the configStrategy here.
    let configStrategyResponse = await new ConfigStrategyHelperKlass().getConfigStrategy(clientId);

    if (configStrategyResponse.isFailure()) {
      return Promise.reject(configStrategyResponse);
    }

    let configStrategy = configStrategyResponse.data;

    // Clear required cache.
    await oThis.deleteProcessQueueAssociateCache(configStrategy, clientId);
    await oThis.deleteClientActiveWorkerUuidCache(configStrategy, clientId);
  },

  /**
   *
   * Delete processQueueAssociationCache.
   * @param configStrategy
   * @param clientId
   * @returns {Promise<void>}
   *
   */
  deleteProcessQueueAssociateCache: async function(configStrategy, clientId) {
    let instanceComposer = new InstanceComposer(configStrategy),
      processQueueAssociateCacheKlass = instanceComposer.getProcessQueueAssociationCache(),
      processQueueAssociateCacheObj = new processQueueAssociateCacheKlass({ client_id: clientId }),
      processQueueAssociationCacheKey = processQueueAssociateCacheObj.setCacheKey();

    let cacheConfigStrategy = {
      OST_CACHING_ENGINE: configStrategy.OST_CACHING_ENGINE,
      OST_CACHE_CONSISTENT_BEHAVIOR: configStrategy.OST_CACHE_CONSISTENT_BEHAVIOR,
      OST_MEMCACHE_SERVERS: configStrategy.OST_MEMCACHE_SERVERS,
      OST_DEFAULT_TTL: configStrategy.OST_DEFAULT_TTL
    };
    let openSTCache = OpenSTCache.getInstance(cacheConfigStrategy),
      cacheImplementer = openSTCache.cacheInstance;

    // Delete processQueueAssociationCacheKey.
    cacheImplementer
      .del(processQueueAssociationCacheKey)
      .then(function() {
        logger.win('processQueueAssociation cache cleared for clientId: ', clientId);
      })
      .catch(function(err) {
        logger.error('processQueueAssociation cache could not be cleared for clientId: ' + clientId + '. Error: ', err);
      });
  },

  /**
   *
   * Delete clientActiveWorkerUuidCache.
   * @param configStrategy
   * @param clientId
   * @returns {Promise<void>}
   *
   */
  deleteClientActiveWorkerUuidCache: async function(configStrategy, clientId) {
    let instanceComposer = new InstanceComposer(configStrategy),
      clientActiveWorkerUuidCacheKlass = instanceComposer.getClientActiveWorkerUuidCache(),
      clientActiveWorkerUuidCacheObj = new clientActiveWorkerUuidCacheKlass({ client_id: clientId }),
      clientActiveWorkerUuidCacheKey = clientActiveWorkerUuidCacheObj.setCacheKey();

    let cacheConfigStrategy = {
      OST_CACHING_ENGINE: configStrategy.OST_CACHING_ENGINE,
      OST_CACHE_CONSISTENT_BEHAVIOR: configStrategy.OST_CACHE_CONSISTENT_BEHAVIOR,
      OST_MEMCACHE_SERVERS: configStrategy.OST_MEMCACHE_SERVERS,
      OST_DEFAULT_TTL: configStrategy.OST_DEFAULT_TTL
    };
    let openSTCache = OpenSTCache.getInstance(cacheConfigStrategy),
      cacheImplementer = openSTCache.cacheInstance;

    // Delete clientActiveWorkerUuidCacheKey.
    cacheImplementer
      .del(clientActiveWorkerUuidCacheKey)
      .then(function() {
        logger.win('clientActiveWorkerUuid cache cleared for clientId: ', clientId);
      })
      .catch(function(err) {
        logger.error('clientActiveWorkerUuid cache could not be cleared for clientId: ' + clientId + '. Error: ', err);
      });
  }
};

module.exports = RmqQueueHelperKlass;
