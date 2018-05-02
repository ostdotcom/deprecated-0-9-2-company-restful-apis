"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop')
  , bitWiseHelperKlass = require(rootPrefix + '/helpers/bitwise_operations')
;

const dbName = "saas_airdrop_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , statuses = {
    '1':clientAirdropConst.incompleteStatus,
    '2':clientAirdropConst.processingStatus,
    '3':clientAirdropConst.completeStatus,
    '4':clientAirdropConst.failedStatus
  }
  , stepsComplete = {
    '1':clientAirdropConst.usersIdentifiedStepComplete,
    '2':clientAirdropConst.tokensTransferedStepComplete,
    '4':clientAirdropConst.contractApprovedStepComplete,
    '8':clientAirdropConst.allocationDoneStepComplete
  }
  , airdropListType = {
    '1':clientAirdropConst.allAddressesAirdropListType,
    '2':clientAirdropConst.neverAirdroppedAddressesAirdropListType,
    '4':clientAirdropConst.everAirdroppedAddressesAirdropListType,
    '8':clientAirdropConst.specificAddressesAirdropListType
  }
  , invertedStatuses = util.invert(statuses)
  , invertedStepsComplete = util.invert(stepsComplete)
  , invertedAirdropListType = util.invert(airdropListType)
;

const ClientAirdropModel = function () {
  const oThis = this
  ;

  bitWiseHelperKlass.call(oThis);
  ModelBaseKlass.call(oThis, {dbName: dbName});
};

ClientAirdropModel.prototype = Object.create(ModelBaseKlass.prototype);
Object.assign(ClientAirdropModel.prototype, bitWiseHelperKlass.prototype);

const ClientAirdropModelSpecificPrototype = {
  tableName: 'client_airdrops',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  stepsComplete: stepsComplete,

  invertedStepsComplete: invertedStepsComplete,

  invertedAirdropListType: invertedAirdropListType,

  enums: {
    'status': {
      val: statuses,
      inverted: invertedStatuses
    }
  },

  getById: function (id) {
    const oThis = this
    ;

    return oThis.select('*').where({id: id}).fire();
  },

  getByClientId: function (clientId) {
    const oThis = this
    ;

    return oThis.select('*').where({client_id: clientId}).fire();
  }
};

/**
 * Set all BitWise columns as hash
 * key would be column name and value would be hash of all bitwise values
 *
 * @return {{}}
 */
ClientAirdropModel.prototype.setBitColumns = function () {
  const oThis = this;

  oThis.bitColumns = {'steps_complete': invertedStepsComplete, 'airdrop_list_type': invertedAirdropListType};

  return oThis.bitColumns;
};

Object.assign(ClientAirdropModel.prototype, ClientAirdropModelSpecificPrototype);

module.exports = ClientAirdropModel;