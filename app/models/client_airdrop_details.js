"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , clientAirdropDetailsConst = require(rootPrefix + '/lib/global_constant/client_airdrop_details')
;

const dbName = "saas_airdrop_"+coreConstants.SUB_ENVIRONMENT+"_"+coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)
  , statuses = {
    '1':clientAirdropDetailsConst.incompleteStatus,
    '2':clientAirdropDetailsConst.completeStatus,
    '3':clientAirdropDetailsConst.failedStatus
  }
  , invertedStatuses = util.invert(statuses)
;

const clientAirdropDetailsKlass = function () {};

clientAirdropDetailsKlass.prototype = Object.create(ModelBaseKlass.prototype);

const clientAirdropDetailsKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'client_airdrop_details',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  enums: {
    'status': {
      val: statuses,
      inverted: invertedStatuses
    }
  },

  getTotalTransferAmount: function (clientAirdropId) {
    const oThis = this;
    return oThis.QueryDB.read(
      oThis.tableName,
      ['sum(airdrop_amount_in_wei) as totalAmountInWei'],
      'id=?',
      [clientAirdropId]);
  },

  getPendingRecordsInbatches: function (clientAirdropId, limit, offset) {
    return QueryDB.read(
      tableName,
      ['managed_address_id, airdrop_amount_in_wei, expiry_timesatmp'],
      'client_airdrop_id=? AND status=?',
      [clientAirdropId, clientAirdropDetailsConst.incompleteStatus],
      {limit: limit, offset: offset, order: 'ID ASC'}
      );
  }


};

Object.assign(clientAirdropDetailsKlass.prototype, clientAirdropDetailsKlassPrototype);

module.exports = clientAirdropDetailsKlass;