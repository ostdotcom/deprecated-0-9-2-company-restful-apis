"use strict";

const rootPrefix = '../..'
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , ModelBaseKlass = require(rootPrefix + '/app/models/base')
    , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
    , allMemcacheInstanceKlass = require(rootPrefix + '/lib/cache_management/all_memcache_instance')
    , util = require(rootPrefix + '/lib/util')
    , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

const dbName = "company_saas_shared_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
    , statuses = {
        '1': criticalChainInteractionLogConst.queuedStatus,
        '2': criticalChainInteractionLogConst.pendingStatus,
        '3': criticalChainInteractionLogConst.processedStatus,
        '4': criticalChainInteractionLogConst.failedStatus,
        '5': criticalChainInteractionLogConst.timeoutStatus
    }
    , invertedStatuses = util.invert(statuses)
    , chainTypes = {
      '1': criticalChainInteractionLogConst.valueChainType,
      '2': criticalChainInteractionLogConst.utilityChainType
    }
    , invertedChainTypes = util.invert(chainTypes)
    , activityTypes = {
      '1': criticalChainInteractionLogConst.requestOstActivityType,
      '2': criticalChainInteractionLogConst.transferToStakerActivityType,
      '3': criticalChainInteractionLogConst.grantEthActivityType,
      '4': criticalChainInteractionLogConst.proposeBtActivityType,
      '5': criticalChainInteractionLogConst.stakerInitialTransferActivityType,
      '6': criticalChainInteractionLogConst.stakeApprovalStartedActivityType,
      '7': criticalChainInteractionLogConst.stakeBtStartedActivityType,
      '8': criticalChainInteractionLogConst.stakeStPrimeStartedActivityType,
      '9': criticalChainInteractionLogConst.deployAirdropActivityType,
      '10': criticalChainInteractionLogConst.setWorkerActivityType,
      '11': criticalChainInteractionLogConst.setPriceOracleActivityType,
      '12': criticalChainInteractionLogConst.setAcceptedMarginActivityType,
      '13': criticalChainInteractionLogConst.setopsAirdropActivityType,
      '14': criticalChainInteractionLogConst.airdropUsersActivityType
    }
    , invertedActivityTypes = util.invert(activityTypes)
;

const CriticalChainInteractionLogModel = function () {

  const oThis = this;

  ModelBaseKlass.call(this, {dbName: dbName});

};

CriticalChainInteractionLogModel.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const CriticalChainInteractionLogPrototype = {

  tableName: 'critical_chain_interaction_logs',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  chainTypes: chainTypes,

  invertedChainTypes: invertedChainTypes,

  activityTypes: activityTypes,

  invertedActivityTypes: invertedActivityTypes,

  enums: {
    'status': {
      val: statuses,
      inverted: invertedStatuses
    },
    'activity_type': {
      val: activityTypes,
      inverted: invertedActivityTypes
    },
    'chain_type': {
      val: chainTypes,
      inverted: invertedChainTypes
    }
  },

  /**
   * Get Data by Ids
   *
   * @param {Array} ids - ids which are to fetched from DB
   *
   * @return {promise<object>}
   */
  getByIds: async function(ids){

    const oThis = this
        , dbRecords = await oThis.select().where(['id IN (?)', ids]).fire();

    var dbRecord = null
        , formattedDbRecords = {};

    for(var i=0; i<dbRecords.length; i++) {
      dbRecord = dbRecords[i];
      dbRecord.request_params = JSON.parse(dbRecord.request_params || '{}');
      dbRecord.response_data = JSON.parse(dbRecord.response_data || '{}');
      formattedDbRecords[parseInt(dbRecord.id)] = dbRecord;
    }

    return formattedDbRecords;

  },

  /**
   * Insert One record in DB
   *
   * @param {Object} data - hash containing data for a row which is to be inserted
   *
   * @return {promise<object>}
   */
  insertRecord: async function(data){

    if (!data.request_params) {
      data.request_params = '{}';
    } else {
      data.request_params = JSON.stringify(data.request_params);
    }

    if (!data.response_data) {
      data.response_data = '{}';
    } else {
      data.response_data = JSON.stringify(data.response_data);
    }

    const oThis = this
        , dbRecord = await oThis.insert(data).fire();

    var idToFlush = data.parent_id;

    if (!idToFlush) {
      idToFlush = dbRecord.insertId;
    }

    oThis.flushTxStatusDetailsCache(idToFlush);

    oThis.flushPendingTxsCache(data.client_token_id);

    return Promise.resolve(dbRecord);

  },

  /**
   * flush cache which has details about current status of tx
   *
   * @param {integer} critical_chain_interaction_log_id - id of parent row
   *
   * @return {promise<result>}
   */
  flushTxStatusDetailsCache: function(critical_chain_interaction_log_id){

    const allMemcacheInstance = new allMemcacheInstanceKlass();
    allMemcacheInstance.clearCache(coreConstants.SHARED_MEMCACHE_KEY_PREFIX + coreConstants.ENVIRONMENT_SHORT + '_c_tx_s_' + critical_chain_interaction_log_id);

  },

  /**
   * flush cache which contain ids of all pending critical interactions
   *
   * @param {integer} client_token_id - client token id
   *
   * @return {promise<result>}
   */
  flushPendingTxsCache: function(client_token_id){

    const allMemcacheInstance = new allMemcacheInstanceKlass();
    allMemcacheInstance.clearCache(coreConstants.SHARED_MEMCACHE_KEY_PREFIX + coreConstants.ENVIRONMENT_SHORT + '_c_pci_ids_' + client_token_id);

  },


  /**
   * update critical chain interaction log <br><br>
   *
   * @return {promise<result>}
   *
   */
  updateCriticalChainInteractionLog: async function (idToUpdate, dataToUpdate, txStatusDetailsCacheId, clientTokenId) {

    const oThis = this;

    if (dataToUpdate.response_data) {
      dataToUpdate.response_data = JSON.stringify(dataToUpdate.response_data);
    }

    if (dataToUpdate.request_params) {
      dataToUpdate.request_params = JSON.stringify(dataToUpdate.request_params);
    }

    await oThis.update(dataToUpdate).where({id: idToUpdate}).fire();

    oThis.flushTxStatusDetailsCache(txStatusDetailsCacheId);

    oThis.flushPendingTxsCache(clientTokenId);

    return Promise.resolve(responseHelper.successWithData({}));

  },


};

Object.assign(CriticalChainInteractionLogModel.prototype, CriticalChainInteractionLogPrototype);

module.exports = CriticalChainInteractionLogModel;