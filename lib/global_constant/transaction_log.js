"use strict";

const rootPrefix = '../..'
  , util = require(rootPrefix + '/lib/util');

const transactionLog = {

  // Status enum types Start //

  processingStatus: 'processing',

  waitingForMiningStatus: 'waiting_for_mining',

  completeStatus: 'complete',

  failedStatus: 'failed',

  // Status enum types end //

  // Chain Types Start //

  valueChainType: 'value',

  utilityChainType: 'utility',

  // Chain Types end //

  // Transaction Types Start //

  tokenTransferTransactionType: 'token_transfer',

  stpTransferTransactionType: 'stp_transfer',

  externalTokenTransferTransactionType: 'external_token_transfer'

  // Transaction Types end //

};

const statuses = {
    '1': transactionLog.processingStatus,
    '2': transactionLog.completeStatus,
    '3': transactionLog.failedStatus,
    '4': transactionLog.waitingForMiningStatus
  }
  , chainTypes = {
    '1': transactionLog.valueChainType,
    '2': transactionLog.utilityChainType
  }
  , transactionTypes = {
    '1': transactionLog.tokenTransferTransactionType,
    '2': transactionLog.stpTransferTransactionType,
    '3': transactionLog.externalTokenTransferTransactionType
  }
  , invertedStatuses = util.invert(statuses)
  , invertedChainTypes = util.invert(chainTypes)
  , invertedTransactionTypes = util.invert(transactionTypes)
;

transactionLog.statuses = statuses;
transactionLog.invertedStatuses = invertedStatuses;

transactionLog.chainTypes = chainTypes;
transactionLog.invertedChainTypes = invertedChainTypes;

transactionLog.transactionTypes = transactionTypes;
transactionLog.invertedTransactionTypes = invertedTransactionTypes;

module.exports = transactionLog;