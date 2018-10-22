'use strict';

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
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
   * Mark multiple statuses as queued.
   *
   * @param transaction_uuids
   * @returns {*}
   */
  markStatusAsQueued(transaction_uuids) {
    const oThis = this;

    return oThis
      .update(['status = ?', oThis.invertedStatuses[transactionMetaConst.queued]])
      .where(['transaction_uuid IN (?)', transaction_uuids])
      .fire();
  },

  /**
   * Mark multiple statuses as processing.
   *
   * @param transaction_uuids
   * @returns {*}
   */
  markStatusAsProcessing(transaction_uuids) {
    const oThis = this;

    return oThis
      .update(['status = ?', oThis.invertedStatuses[transactionMetaConst.processing]])
      .where(['transaction_uuid IN (?)', transaction_uuids])
      .fire();
  },

  /**
   * Mark multiple statuses as failed.
   *
   * @param transaction_uuids
   * @returns {*}
   */
  markStatusAsFailed(transaction_uuids) {
    const oThis = this;

    return oThis
      .update(['status = ?', oThis.invertedStatuses[transactionMetaConst.failed]])
      .where(['transaction_uuid IN (?)', transaction_uuids])
      .fire();
  },

  /**
   * Mark multiple statuses as submitted.
   *
   * @param transaction_uuids
   * @returns {*}
   */
  markStatusAsSubmitted(transaction_uuids) {
    const oThis = this;

    return oThis
      .update(['status = ?', oThis.invertedStatuses[transactionMetaConst.submitted]])
      .where(['transaction_uuid IN (?)', transaction_uuids])
      .fire();
  },

  /**
   * Mark multiple statuses as geth_down.
   *
   * @param transaction_uuids
   * @returns {*}
   */
  markStatusAsGethDown(transaction_uuids) {
    const oThis = this;

    return oThis
      .update(['status = ?', oThis.invertedStatuses[transactionMetaConst.geth_down]])
      .where(['transaction_uuid IN (?)', transaction_uuids])
      .fire();
  },

  /**
   * Mark multiple statuses as insufficient_gas.
   *
   * @param transaction_uuids
   * @returns {*}
   */
  markStatusAsInsufficientGas(transaction_uuids) {
    const oThis = this;

    return oThis
      .update(['status = ?', oThis.invertedStatuses[transactionMetaConst.insufficient_gas]])
      .where(['transaction_uuid IN (?)', transaction_uuids])
      .fire();
  },

  /**
   * Mark multiple statuses as nonce_too_low.
   *
   * @param transaction_uuids
   * @returns {*}
   */
  markStatusAsNonceTooLow(transaction_uuids) {
    const oThis = this;

    return oThis
      .update(['status = ?', oThis.invertedStatuses[transactionMetaConst.nonce_too_low]])
      .where(['transaction_uuid IN (?)', transaction_uuids])
      .fire();
  },

  /**
   * Mark multiple statuses as replacement_tx_under_priced.
   *
   * @param transaction_uuids
   * @returns {*}
   */
  markStatusAsReplacementTxUnderpriced(transaction_uuids) {
    const oThis = this;

    return oThis
      .update(['status = ?', oThis.invertedStatuses[transactionMetaConst.replacement_tx_under_priced]])
      .where(['transaction_uuid IN (?)', transaction_uuids])
      .fire();
  },

  /**
   * Mark multiple statuses as mined.
   *
   * @param transaction_uuids
   * @returns {*}
   */
  markStatusAsMined(transaction_uuids) {
    const oThis = this;

    return oThis
      .update(['status = ?', oThis.invertedStatuses[transactionMetaConst.mined]])
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

module.exports = TransactionMetaModel;
