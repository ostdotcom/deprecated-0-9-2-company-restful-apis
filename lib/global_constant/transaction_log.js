"use strict";

const transactionLog = {

  // Status enum types Start //

  processingStatus: 'processing',

  waitingForMiningStatus: 'waiting_for_mining',

  completeStatus: 'complete',

  failedStatus: 'failed',

  // Status enum types Start //


  // Chain Types Start //

  valueChainType: 'value',

  utilityChainType: 'utility'

  // Chain Types Start //

};

module.exports = transactionLog;