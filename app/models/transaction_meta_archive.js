'use strict';

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util'),
  ModelBaseKlass = require(rootPrefix + '/app/models/base'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  transactionLogConst = require(rootPrefix + '/lib/global_constant/transaction_log'),
  transactionMetaConst = require(rootPrefix + '/lib/global_constant/transaction_meta'),
  TransactionMetaModel = require(rootPrefix + '/app/models/transaction_meta');

const dbName = 'saas_transaction_' + coreConstants.SUB_ENVIRONMENT + '_' + coreConstants.ENVIRONMENT;

const kinds = {
  '1': transactionLogConst.tokenTransferTransactionType,
  '2': transactionLogConst.stpTransferTransactionType,
  '3': transactionLogConst.externalTokenTransferTransactionType
};

const invertedKinds = util.invert(kinds);

const TransactionMetaArchiveModel = function() {
  ModelBaseKlass.call(this, { dbName: dbName });
};

TransactionMetaArchiveModel.prototype = Object.create(ModelBaseKlass.prototype);

const TransactionMetaArchiveModelSpecificPrototype = {
  tableName: 'transaction_meta_archive',

  kinds: kinds,

  invertedKinds: invertedKinds,

  statuses: transactionMetaConst.statuses,

  invertedStatuses: transactionMetaConst.invertedStatuses
};

Object.assign(TransactionMetaArchiveModel.prototype, TransactionMetaModel.prototype);
Object.assign(TransactionMetaArchiveModel.prototype, TransactionMetaArchiveModelSpecificPrototype);

module.exports = TransactionMetaArchiveModel;
