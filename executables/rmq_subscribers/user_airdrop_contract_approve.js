"use strict";

/**
 *
 * Start airdrop contract approval for users by subscribing to RMQ events.<br><br>
 *
 * @module executables/rmq_subscribers/user_airdrop_contract_approve
 *
 *
 */
const rootPrefix = '../..';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

// Include Process Locker File
const ProcessLockerKlass = require(rootPrefix + '/lib/process_locker')
  , ProcessLocker = new ProcessLockerKlass()
;
const args = process.argv
  , processId = args[2]
;

var unAckCount = 0;

ProcessLocker.canStartProcess({process_title: 'cra_single_worker_execute_transaction'+processId});
ProcessLocker.endAfterTime({time_in_minutes: 60});

// Load external packages
const openSTNotification = require('@openstfoundation/openst-notification');

//All Module Requires.
const logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , userAirdropContractApproveKlass = require(rootPrefix + '/lib/airdrop_management/distribute_tokens/user_airdrop_contract_approve')
;

openSTNotification.subscribeEvent.rabbit(["newTransaction.execute"],
  {
    queue: 'new_transactions',
    ackRequired: 1,
    prefetch: 50
  },
  function (params) {

    // Promise is required to be returned to manually ack messages in RMQ
    return new Promise(async function (onResolve, onReject) {

      unAckCount++;
      // Process request
      const parsedParams = JSON.parse(params);
      logger.step('Consumed execute transaction start params -> ', parsedParams);

      const payload = parsedParams.message.payload
        , airdropId = payload.airdrop_id
        , clientBrandedTokenId = payload.client_branded_token_id
        , userAirdropContractApproveObj = new userAirdropContractApproveKlass(
        {
          airdrop_id: airdropId,
          client_branded_token_id: clientBrandedTokenId
        })
      ;

      try{
        userAirdropContractApproveObj.perform().then(function (response) {
          if (!response.isSuccess()) {
            logger.error('e_rmqs_et_1', 'Something went wrong in approve user airdrop unAckCount remains -> ', unAckCount, response, params);
          }
          unAckCount--;
          // ack RMQ
          return onResolve();
        }).catch(function (err) {
          logger.error('e_rmqs_et_2', 'Something went wrong in approve user airdrop unAckCount remains -> ', unAckCount, err, params);
          unAckCount--;
          // ack RMQ
          return onResolve();
        });
      } catch(err) {
        unAckCount--;
        logger.error("Listener could not process approve user airdrop.. Catch. unAckCount remains -> ", unAckCount);
        return onResolve();
      }
    });

  }
);


// Using a single function to handle multiple signals
function handle() {
  logger.info('Received Signal');
  var f = function(){
    if (unAckCount <= 0) {
      process.exit(1);
    } else {
      logger.info('waiting for open tasks to be done.', unAckCount);
      setTimeout(f, 1000);
    }
  };

  setTimeout(f, 1000);
}

// handling gracefull process exit on getting SIGINT, SIGTERM.
// Once signal found programme will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);
