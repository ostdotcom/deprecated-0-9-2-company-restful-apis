"use strict";

/**
 *
 * Start Airdrop for a client token by subscribing to RMQ events.<br><br>
 *
 * @module executables/rmq_subscribers/start_airdrop
 *
 */

// Include Process Locker File
const rootPrefix = '../..'
  , ProcessLockerKlass = require(rootPrefix + '/lib/process_locker')
  , ProcessLocker = new ProcessLockerKlass()
;

ProcessLocker.canStartProcess({process_title: 'cra_single_worker_start_airdrop'});

// Load external packages
const openSTNotification = require('@openstfoundation/openst-notification');

//All Module Requires.
const logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , startAirdropKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/start')
;

openSTNotification.subscribeEvent.rabbit(["airdrop.start.#"],
  {
    queue: 'start_airdrop_from_restful_apis',
    ackRequired: 1,
    prefetch: 5
  },
  function (params) {


    // Promise is required to be returned to manually ack messages in RMQ
    return new Promise(async function (onResolve, onReject) {
      // Process request
      const parsedParams = JSON.parse(params);
      logger.step('Consumed airdrop start params -> ', parsedParams);

      const payload = parsedParams.message.payload
        , clientAirdropId = payload.client_airdrop_id
        , startAirdrop = new startAirdropKlass({client_airdrop_id: clientAirdropId})
      ;

      startAirdrop.perform().then(function (response) {
        if (!response.isSuccess()) {
          logger.notify('e_rmqs_sa_1', 'Something went wrong in airdrop distribution', response, params);
        }
        // ack RMQ
        return onResolve();
      }).catch(function (err) {
        logger.notify('e_rmqs_sa_2', 'Something went wrong in airdrop distribution', err, params);
        // ack RMQ
        return onResolve();
      });
    });

  }
);


