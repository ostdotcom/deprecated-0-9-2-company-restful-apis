'use strict';

const rmqQueues = {
  // Queue name prefix starts

  commandMessageQueuePrefix: 'command_message_queue_',

  executeTxQueuePrefix: 'execute_transaction_queue_',

  // Queue name pefix ends

  // Topic name prefix starts

  commandMessageTopicPrefix: 'command_message_topic_',

  executeTxTopicPrefix: 'execute_transaction_topic_'

  // Topic name prefix ends
};

module.exports = rmqQueues;
