'use strict';

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  LockableBaseKlass = require(rootPrefix + '/app/models/lockable_base'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  transactionMetaConst = require(rootPrefix + '/lib/global_constant/transaction_meta');

const dbName = 'saas_transaction_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT;

const kinds = {
  '1': transactionLogConst.tokenTransferTransactionType,
  '2': transactionLogConst.stpTransferTransactionType,
  '3': transactionLogConst.externalTokenTransferTransactionType
};

const invertedKinds = util.invert(kinds);

const TransactionMetaModel = function() {
  ModelBaseKlass.call(this, { dbName: dbName });
  LockableBaseKlass.call(this);
};

TransactionMetaModel.prototype = Object.create(ModelBaseKlass.prototype);

const TransactionMetaModelSpecificPrototype = {
  tableName: 'transaction_meta',

  kinds: kinds,

  invertedKinds: invertedKinds,

  statuses: transactionMetaConst.statuses,

  invertedStatuses: transactionMetaConst.invertedStatuses,

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
   * Get by lock ID
   *
   * @param lockId
   * @returns {Promise<*>}
   */
  getByLockId: async function(lockId) {
    const oThis = this;

    return oThis
      .select('*')
      .where(['lock_id = ?', lockId])
      .fire();
  },

  /**
   * bulk insert
   *
   * @param record - record to be inserted
   *
   * @return {Promise}
   */
  insertRecord: async function(record) {
    const oThis = this;

    return oThis.insert(record).fire();
  },

  /**
   * Get info for a single id.
   *
   * @param id
   * @returns {*}
   */
  getById: function(id) {
    const oThis = this;

    return oThis
      .select('*')
      .where({ id: id })
      .fire();
  },

  /**
   * Get info by ids.
   *
   * @param ids
   * @returns {Promise<never>}
   */
  getByIds: async function(ids) {
    const oThis = this;

    return oThis
      .select('*')
      .where(['id IN (?)', ids])
      .fire();
  },

  /**
   * Get info for a single transaction_uuid.
   *
   * @param transaction_uuid
   * @returns {*}
   */
  getByTransactionUuid: function(transaction_uuid) {
    const oThis = this;

    return oThis
      .select('*')
      .where({ transaction_uuid: transaction_uuid })
      .fire();
  },

  /**
   * Get info by transaction_uuids.
   *
   * @param transaction_uuids
   * @returns {Promise<never>}
   */
  getByTransactionUuids: async function(transaction_uuids) {
    const oThis = this;

    return oThis
      .select('*')
      .where(['transaction_uuid IN (?)', transaction_uuids])
      .fire();
  },

  /**
   * @param {string} status - status which is to be marked for given uuids
   * @param {array} transaction_uuids - transaction_uuids
   *
   */
  changeStatusOfUuids(status, transaction_uuids) {
    const oThis = this;

    let txMetaStatus = oThis.invertedStatuses[transactionMetaConst[status]];

    return oThis
      .update(['status = ?', txMetaStatus])
      .where(['transaction_uuid IN (?)', transaction_uuids])
      .fire();
  },

  /**
   * Mark multiple statuses as mined.
   *
   * @param transaction_hashes
   * @returns {*}
   */
  markStatusAsMinedByTxHashes(transaction_hashes) {
    const oThis = this;

    return oThis
      .update(['status = ?', oThis.invertedStatuses[transactionMetaConst.mined]])
      .where(['transaction_hash IN (?)', transaction_hashes])
      .fire();
  },

  /**
   * Mark multiple statuses as unknown.
   *
   * @param transaction_uuids
   * @returns {*}
   */
  markStatusAsUnknown(transaction_uuids) {
    const oThis = this;

    return oThis
      .update(['status = ?', oThis.invertedStatuses[transactionMetaConst.unknown]])
      .where(['transaction_uuid IN (?)', transaction_uuids])
      .fire();
  }
};

Object.assign(TransactionMetaModel.prototype, TransactionMetaModelSpecificPrototype);

Object.assign(TransactionMetaModel.prototype, LockableBaseKlass.prototype);

module.exports = TransactionMetaModel;
