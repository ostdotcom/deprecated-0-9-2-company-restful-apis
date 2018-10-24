'use strict';

const rootPrefix = '../..';

const recognizedInternalErrorIdentifiers = {
  // chain node down
  chainNodeDown: 'err_chain_node_down',

  gasLowError: 'l_ci_h_pse_gas_low', // it comes from platform

  ddbDownError: 'err_dynamo_db_down',

  replacementTxUnderPriced: 'err_replacement_tx_under_priced'
};

module.exports = recognizedInternalErrorIdentifiers;
