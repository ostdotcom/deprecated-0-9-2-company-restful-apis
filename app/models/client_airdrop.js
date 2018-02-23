"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
;

const dbName = "saas_airdrop_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)

  , statuses = {
    '1':clientAirdropConst.incompleteStatus,
    '2':clientAirdropConst.processingStatus,
    '3':clientAirdropConst.completeStatus,
    '4':clientAirdropConst.failedStatus
  }
  , stepsComplete = {
    '1':clientAirdropConst.userIdentifiedStepComplete,
    '2':clientAirdropConst.tokensTransferedStepComplete,
    '4':clientAirdropConst.contractApprovedStepComplete,
    '8':clientAirdropConst.allocationDoneStepComplete
  }
  , airdropListType = {
    '1':clientAirdropConst.allAddressesAirdropListType,
    '2':clientAirdropConst.neverAirdroppedAddressesAirdropListType,
    '3':clientAirdropConst.specificAddressesAirdropListType
  }
  , invertedStatuses = util.invert(statuses)
  , invertedStepsComplete = util.invert(stepsComplete)
  , invertedAirdropListType = util.invert(airdropListType)
;

const ClientAirdropKlass = function () {};

ClientAirdropKlass.prototype = Object.create(ModelBaseKlass.prototype);

const ClientAirdropKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'client_airdrops',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  stepsComplete: stepsComplete,

  invertedStepsComplete: invertedStepsComplete,

  enums: {
    'status': {
      val: statuses,
      inverted: invertedStatuses
    },
    'steps_complete': {
      val: stepsComplete,
      inverted: invertedStepsComplete
    },
    'airdrop_list_type': {
      val: airdropListType,
      inverted: invertedAirdropListType
    }
  },

  get: function (clientAirdropId) {
    return QueryDB.read(
      tableName,
      [],
      'id=?',
      [clientAirdropId]);
  },

  is_user_identifed_step_done: function (stepsComplete) {
    var oThis = this;
    return oThis.is_bit_present(stepsComplete, invertedAirdropListType, clientAirdropConst.userIdentifiedStepComplete)
  },


};

Object.assign(ClientAirdropKlass.prototype, ClientAirdropKlassPrototype);

module.exports = ClientAirdropKlass;