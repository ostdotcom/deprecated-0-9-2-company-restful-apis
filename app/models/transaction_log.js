"use strict";

const rootPrefix = '../..'
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , QueryDBKlass = require(rootPrefix + '/app/models/queryDb')
  , util = require(rootPrefix + '/lib/util')
  , ModelBaseKlass = require(rootPrefix + '/app/models/base')
  , transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log')
;

const dbName = "saas_transaction_" + coreConstants.SUB_ENVIRONMENT + "_" + coreConstants.ENVIRONMENT
  , QueryDBObj = new QueryDBKlass(dbName)

  , statuses = {
    '1': transactionLogConst.processingStatus,
    '2': transactionLogConst.completeStatus,
    '3': transactionLogConst.failedStatus
  }
  , chainTypes = {
    '1': transactionLogConst.valueChainType,
    '2': transactionLogConst.utilityChainType
  }
  , invertedStatuses = util.invert(statuses)
  , invertedChainTypes = util.invert(chainTypes)
;

const TransactionLogKlass = function () {
  ModelBaseKlass.call(this, {dbName: dbName});
};

TransactionLogKlass.prototype = Object.create(ModelBaseKlass.prototype);

const TransactionLogKlassPrototype = {

  QueryDB: QueryDBObj,

  tableName: 'transaction_logs',

  statuses: statuses,

  invertedStatuses: invertedStatuses,

  chainTypes: chainTypes,

  invertedChainTypes: invertedChainTypes,

  enums: {
    'status': {
      val: statuses,
      inverted: invertedStatuses
    },
    'chain_type': {
      val: chainTypes,
      inverted: invertedChainTypes
    }
  },

  /**
   *
   * @param [Array] uuids - Array of Transaction uuids
   * @return {Promise<>}
   */
  getByTransactionUuid: function (uuids) {
    var oThis = this;
    return oThis.QueryDB.readByInQuery(
      oThis.tableName,
      [],
      uuids, 'transaction_uuid');
  },

  /**
   *
   * @param transaction_hashes - Array of Transaction hash
   * @return {Promise<>}
   */
  getByTransactionHash: function (transaction_hashes) {
    var oThis = this;
    return oThis.QueryDB.readByInQuery(
      oThis.tableName,
      [],
      transaction_hashes, 'transaction_hash');
  }

};

Object.assign(TransactionLogKlass.prototype, TransactionLogKlassPrototype);

module.exports = TransactionLogKlass;