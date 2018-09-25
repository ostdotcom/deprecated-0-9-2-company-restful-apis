'use strict';

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  util = require(rootPrefix + '/lib/util'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  clientAirdropDetailsConst = require(rootPrefix + '/lib/global_constant/client_airdrop_details');

const dbName = 'saas_airdrop_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT,
  statuses = {
    '1': clientAirdropDetailsConst.incompleteStatus,
    '2': clientAirdropDetailsConst.completeStatus,
    '3': clientAirdropDetailsConst.failedStatus
  },
  invertedStatuses = util.invert(statuses);

const ClientAirdropDetailModel = function() {
  const oThis = this;

  ModelBaseKlass.call(oThis, { dbName: dbName });
};

ClientAirdropDetailModel.prototype = Object.create(ModelBaseKlass.prototype);

const ClientAirdropDetailModelSpecificPrototype = {
  tableName: 'client_airdrop_details',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  enums: {
    status: {
      val: statuses,
      inverted: invertedStatuses
    }
  },

  getTotalTransferAmount: function(clientAirdropId) {
    const oThis = this;

    return oThis
      .select('sum(airdrop_amount_in_wei) as totalAmountInWei')
      .where({ client_airdrop_id: clientAirdropId })
      .fire();
  },

  getPendingRecordsInbatches: function(clientAirdropId, limit, offset) {
    const oThis = this,
      incompleteStatusInt = oThis.invertedStatuses[clientAirdropDetailsConst.incompleteStatus];

    return oThis
      .select('*')
      .where({ client_airdrop_id: clientAirdropId, status: incompleteStatusInt })
      .limit(limit)
      .offset(offset)
      .order_by('id ASC')
      .fire();
  }
};

Object.assign(ClientAirdropDetailModel.prototype, ClientAirdropDetailModelSpecificPrototype);

module.exports = ClientAirdropDetailModel;
