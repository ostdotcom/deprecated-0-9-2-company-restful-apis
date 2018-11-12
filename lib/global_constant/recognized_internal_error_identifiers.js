'use strict';

const recognizedInternalErrorIdentifiers = {
  // chain node down
  chainNodeDown: 'err_chain_node_down',

  gasLowError: 'err_gas_too_low',

  ddbDownError: 'err_dynamo_db_down',

  replacementTxUnderPriced: 'err_replacement_tx_under_priced',

  nonceTooLow: 'err_nonce_too_low',

  insufficientFunds: 'err_insufficient_funds',

  chainNodeSyncError: 'err_chain_node_sync_error'
};

module.exports = recognizedInternalErrorIdentifiers;
