'use strict';

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  util = require(rootPrefix + '/lib/util'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  clientAirdropConst = require(rootPrefix + '/lib/global_constant/client_airdrop'),
  bitWiseHelperKlass = require(rootPrefix + '/helpers/bitwise_operations');

const dbName = 'saas_airdrop_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT,
  statuses = {
    '1': clientAirdropConst.incompleteStatus,
    '2': clientAirdropConst.processingStatus,
    '3': clientAirdropConst.completeStatus,
    '4': clientAirdropConst.failedStatus
  },
  stepsComplete = {
    '1': clientAirdropConst.usersIdentifiedStepComplete,
    '2': clientAirdropConst.tokensTransferedStepComplete,
    '4': clientAirdropConst.contractApprovedStepComplete,
    '8': clientAirdropConst.allocationDoneStepComplete
  },
  airdropListType = {
    '1': clientAirdropConst.allAddressesAirdropListType,
    '2': clientAirdropConst.neverAirdroppedAddressesAirdropListType,
    '4': clientAirdropConst.everAirdroppedAddressesAirdropListType,
    '8': clientAirdropConst.specificAddressesAirdropListType
  },
  invertedStatuses = util.invert(statuses),
  invertedStepsComplete = util.invert(stepsComplete),
  invertedAirdropListType = util.invert(airdropListType);

const ClientAirdropModel = function() {
  const oThis = this;

  bitWiseHelperKlass.call(oThis);
  ModelBaseKlass.call(oThis, { dbName: dbName });
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
    status: {
      val: statuses,
      inverted: invertedStatuses
    }
  },

  getById: function(id) {
    const oThis = this;

    return oThis
      .select('*')
      .where({ id: id })
      .fire();
  },

  getByClientId: function(clientId) {
    const oThis = this;

    return oThis
      .select('*')
      .where({ client_id: clientId })
      .fire();
  },

  /**
   *
   * Get List by params
   *
   * @param {object} params - this is object with keys.
   * @param {integer} params.client_id - client_id for which users are to be fetched
   * @param {string} [params.order_by] - ordering of results to be done by this column
   * @param {string} [params.order] - ASC / DESC
   * @param {string} [params.limit] - number of results to be returned on this page
   * @param {string} [params.offset] - index to start fetching entries from
   * @param {array} [params.airdrop_uuids] - airdrop uuids from which result sets will be found
   * @param {array} [params.current_statuses] - Filter of statuses to be fetched in result
   *
   */
  getByFilterAndPaginationParams: function(params) {
    const oThis = this,
      clientId = params.client_id,
      orderBy = params.order_by,
      orderType = params.order,
      airdropUuidsForFiltering = params.airdrop_uuids || [],
      currentStatusesForFiltering = params.current_statuses;

    let query = oThis.select(['id', 'airdrop_uuid', 'status', 'steps_complete']).where({ client_id: clientId });

    if (airdropUuidsForFiltering.length > 0) {
      query.where(['airdrop_uuid IN (?)', airdropUuidsForFiltering]);
    }

    if (currentStatusesForFiltering.length > 0) {
      var qryArr = [];
      for (var i = 0; i < currentStatusesForFiltering.length; i++) {
        qryArr.push(invertedStatuses[currentStatusesForFiltering[i]]);
      }
      query.where(['status in (?)', qryArr]);
    }

    let orderByStr = 'id';
    orderByStr += orderType.toLowerCase() == 'asc' ? ' ASC' : ' DESC';

    return query
      .order_by(orderByStr)
      .limit(params.limit)
      .offset(params.offset)
      .fire();
  }
};

/**
 * Set all BitWise columns as hash
 * key would be column name and value would be hash of all bitwise values
 *
 * @return {{}}
 */
ClientAirdropModel.prototype.setBitColumns = function() {
  const oThis = this;

  oThis.bitColumns = { steps_complete: invertedStepsComplete, airdrop_list_type: invertedAirdropListType };

  return oThis.bitColumns;
};

Object.assign(ClientAirdropModel.prototype, ClientAirdropModelSpecificPrototype);

module.exports = ClientAirdropModel;
