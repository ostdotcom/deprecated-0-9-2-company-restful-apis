'use strict';

const commandMessage = {
  // Kind enum types starts

  holdWorker: 'holdWorker',

  exTransactionsStopped: 'exTransactionsStopped',

  exTransactionsDone: 'exTransactionsDone',

  startDhq: 'startDhq',

  dhqTransactionsDone: 'dhqTransactionsDone',

  startDq: 'startDq',

  // Kind enum types ends

  // Status enum types starts

  sent: 'sent',

  received: 'received'

  // Status enum types ends
};

module.exports = commandMessage;
