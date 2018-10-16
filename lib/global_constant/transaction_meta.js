'use strict';

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util');

const transactionMetaConst = {
  // Tx Meta enum types Start //

  queued: 'queued',

  processing: 'processing',

  failed: 'failed',

  submitted: 'submitted',

  geth_down: 'gethDown',

  insufficient_gas: 'insufficientGas',

  nonce_too_low: 'nonceTooLow',

  replacement_tx_under_priced: 'replacementTxUnderpriced',

  mined: 'mined',

  unknown: 'unknown'

  // Tx Meta enum types Start //
};

const statuses = {
    '1': transactionMetaConst.queued,
    '2': transactionMetaConst.processing,
    '3': transactionMetaConst.failed,
    '4': transactionMetaConst.submitted,
    '5': transactionMetaConst.geth_down,
    '6': transactionMetaConst.insufficient_gas,
    '7': transactionMetaConst.nonce_too_low,
    '8': transactionMetaConst.replacement_tx_under_priced,
    '9': transactionMetaConst.mined,
    '10': transactionMetaConst.unknown
  },
  invertedStatuses = util.invert(statuses);

transactionMetaConst.statuses = statuses;
transactionMetaConst.invertedStatuses = invertedStatuses;

module.exports = transactionMetaConst;
