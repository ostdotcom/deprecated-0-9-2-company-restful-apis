'use strict';

const rmqQueues = {
  // Queue name prefix starts

  commandMessageQueuePrefix: 'command_message_queue_',

  executeTxQueuePrefix: 'execute_transaction_queue_',

  // Queue name prefix ends

  // Topic name prefix starts

  commandMessageTopicPrefix: 'command_message_topic_',

  executeTxTopicPrefix: 'execute_transaction_topic_',

  // Topic name prefix ends

  // Message kinds starts

  executeTx: 'execute_transaction',

  commandMsg: 'command_message'

  // Message kinds ends
};

module.exports = rmqQueues;
