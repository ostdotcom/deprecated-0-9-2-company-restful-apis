"use strict";

const rootPrefix = '../..'
    , coreConstants = require(rootPrefix + '/config/core_constants')
    , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
    , ModelBaseKlass = require(rootPrefix + '/app/models/base')
    , criticalChainInteractionLogConst = require(rootPrefix + '/lib/global_constant/critical_chain_interaction_log')
    , util = require(rootPrefix + '/lib/util')
;

const dbName = "company_saas_shared_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
    , QueryDBObj = new QueryDBKlass(dbName)
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

const CriticalChainInteractionLogKlass = function () {

  const oThis = this;

  ModelBaseKlass.call(this, {dbName: dbName});

};

CriticalChainInteractionLogKlass.prototype = Object.create(ModelBaseKlass.prototype);

/*
 * Public methods
 */
const CriticalChainInteractionLogPrototype = {

  QueryDB: QueryDBObj,

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

  getByIds: async function(ids){

    const oThis = this
        , dbRecords = await oThis.QueryDB.readByInQuery(
        oThis.tableName,
        [],
        ids,
        'id'
    );

    var dbRecord = null;

    for(var i=0; i<dbRecords.length; i++) {
      dbRecord = dbRecords[i];
      dbRecord.request_params = JSON.parse(dbRecord.request_params);
      dbRecord.response_data = JSON.parse(dbRecord.response_data);
    }

    return dbRecords;

  }

};

Object.assign(CriticalChainInteractionLogKlass.prototype, CriticalChainInteractionLogPrototype);

module.exports = CriticalChainInteractionLogKlass;