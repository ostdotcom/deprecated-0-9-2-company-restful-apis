"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , bitWiseHelperKlass = require(rootPrefix + '/helpers/bitwise_operations')
;

const dbName = "saas_airdrop_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)

  , statuses = {
    '1':clientAirdropConst.incompleteStatus,
    '2':clientAirdropConst.processingStatus,
    '3':clientAirdropConst.completeStatus,
    '4':clientAirdropConst.failedStatus
  }
  , invertedStepsComplete = {
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
  , stepsComplete = util.invert(invertedStepsComplete)
  , invertedAirdropListType = util.invert(airdropListType)
;

const ClientAirdropKlass = function () {
  bitWiseHelperKlass.call(this);
};

ClientAirdropKlass.prototype = Object.create(ModelBaseKlass.prototype);
ClientAirdropKlass.prototype = Object.create(bitWiseHelperKlass.prototype);

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
    'airdrop_list_type': {
      val: airdropListType,
      inverted: invertedAirdropListType
    }
  },

  get: function (clientAirdropId) {
    const oThis = this;
    return oThis.QueryDB.read(
      oThis.tableName,
      [],
      'id=?',
      [clientAirdropId]);
  }


};

/**
 * Set all BitWise columns as hash
 * key would be column name and value would be hash of all bitwise values
 *
 * @return {{}}
 */
ClientAirdropKlass.prototype.setBitColumns = function () {
  const oThis = this;

  oThis.bitColumns = {'steps_complete': stepsComplete};

  return oThis.bitColumns;
};

Object.assign(ClientAirdropKlass.prototype, ClientAirdropKlassPrototype);

module.exports = ClientAirdropKlass;