'use strict';

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/core_constants'),
  util = require(rootPrefix + '/lib/util'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log');

const dbName = 'saas_transaction_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT;

const kinds = {
  '1': transactionLogConst.tokenTransferTransactionType,
  '2': transactionLogConst.stpTransferTransactionType,
  '3': transactionLogConst.externalTokenTransferTransactionType
};

const invertedKinds = util.invert(kinds);

const TransactionMetaModel = function() {
  ModelBaseKlass.call(this, { dbName: dbName });
};

TransactionMetaModel.prototype = Object.create(ModelBaseKlass.prototype);

const TransactionMetaModelSpecificPrototype = {
  tableName: 'transaction_meta',

  kinds: kinds,

  invertedKinds: invertedKinds,

  /**
   * Get by transaction hash
   *
   * @param transactionHashes - Array of Transaction hash
   * @param chainId - chain id
   *
   * @return {promise}
   */
  getByTransactionHash: async function(transactionHashes, chainId) {
    const oThis = this;

    return oThis
      .select('*')
      .where(['transaction_hash IN (?) AND chain_id = ?', transactionHashes, chainId])
      .fire();
  },

  /**
   * bulk insert
   *
   * @param record - record to be inserted
   *
   * @return {promise}
   */
  insertRecord: async function(record) {
    const oThis = this;

    return oThis.insert(record).fire();
  }
};

Object.assign(TransactionMetaModel.prototype, TransactionMetaModelSpecificPrototype);

module.exports = TransactionMetaModel;
