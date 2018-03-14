"use strict";

/**
 *
 * Start Airdrop for a client token by subscribing to RMQ events.<br><br>
 *
 * @module executables/rmq_subscribers/start_airdrop
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

ProcessLocker.canStartProcess({process_title: 'executables_rmq_subscribers_execute_transaction'+processId});
ProcessLocker.endAfterTime({time_in_minutes: 60});

// Load external packages
const openSTNotification = require('@openstfoundation/openst-notification');

//All Module Requires.
const logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , executeTransactionKlass = require(rootPrefix + '/app/services/transaction/execute_transaction')
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
        , transactionLogId = payload.transactionLogId
        , transactionUuid = payload.transactionUuid
        , executeTransactionObj = new executeTransactionKlass(
          {
            transactionLogId: transactionLogId,
            transactionUuid: transactionUuid,
            runInSync: 1
          })
      ;

      try{
        executeTransactionObj.perform().then(function (response) {
          if (!response.isSuccess()) {
            logger.error('e_rmqs_et_1', 'Something went wrong in transaction execution unAckCount ->', unAckCount, response, params);
          }
          unAckCount--;
          logger.info("------ unAckCount -> ", unAckCount);
          // ack RMQ
          return onResolve();
        }).catch(function (err) {
          logger.error('e_rmqs_et_2', 'Something went wrong in transaction execution. unAckCount ->', unAckCount, err, params);
          unAckCount--;
          // ack RMQ
          return onResolve();
        });
      } catch(err) {
        unAckCount--;
        logger.error("Listener could not process transaction.. Catch. unAckCount -> ", unAckCount);
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
      logger.info('waiting for open tasks to be done.');
      setTimeout(f, 1000);
    }
  };

  setTimeout(f, 1000);
}

// handling gracefull process exit on getting SIGINT, SIGTERM.
// Once signal found programme will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);



