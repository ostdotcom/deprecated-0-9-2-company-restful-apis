'use strict';

const rmqQueues = {
  // Queue name prefix starts

  commandMessageQueuePrefix: 'command_message_queue',

  executeTxQueuePrefix: 'execute_transaction_queue',

  // Queue name prefix ends

  // Topic name prefix starts

  commandMessageTopicPrefix: 'executeTx.command_message',

  executeTxTopicPrefix: 'transaction.execute',

  // Topic name prefix ends

  // Message kinds starts

  executeTx: 'execute_transaction',

  commandMsg: 'command_message'

  // Message kinds ends
};

module.exports = rmqQueues;
