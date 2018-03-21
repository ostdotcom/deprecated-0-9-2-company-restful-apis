"use strict";

/**
 *
 * Start Airdrop for a client token by subscribing to RMQ events.<br><br>
 *
 * @module executables/rmq_subscribers/start_airdrop
 *
 */
const rootPrefix = '../..';

// Load external packages
const openSTNotification = require('@openstfoundation/openst-notification');


const publishToSlowQueue = async function (parsedParams) {
  openSTNotification.publishEvent.perform(
    {
      topics: ['slow.transaction.execute'],
      publisher: parsedParams.publisher,
      message: parsedParams.message
    }
  ).then(console.log, console.log);
};

openSTNotification.subscribeEvent.rabbit([topicPrefix+"transaction.execute"],
  {
    queue: 'transaction_execute_from_restful_apis',
    ackRequired: 1,
    prefetch: 100
  },
  function (params) {

    publishToSlowQueue(JSON.parse(params));

    // Promise is required to be returned to manually ack messages in RMQ
    return Promise.resolve();

  }
);


