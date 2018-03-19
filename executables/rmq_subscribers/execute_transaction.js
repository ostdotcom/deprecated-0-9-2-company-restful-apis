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
  , PromiseQueueManagerKlass = require( rootPrefix + "/executables/rmq_subscribers/PromiseQueueManager")
  , ProcessLocker = new ProcessLockerKlass()
;
const args = process.argv
  , processId = args[2]
  , slowProcessor = args[3]
;

var unAckCount = 0;

ProcessLocker.canStartProcess({process_title: 'executables_rmq_subscribers_execute_transaction'+processId+'-'+(slowProcessor || '')});
//ProcessLocker.endAfterTime({time_in_minutes: 60});

// Load external packages
const openSTNotification = require('@openstfoundation/openst-notification');

//All Module Requires.
const logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , executeTransactionKlass = require(rootPrefix + '/app/services/transaction/execute_transaction')
;

const promiseExecutor = function (onResolve, onReject, params ) {

  unAckCount++;
  // Process request
  const parsedParams = JSON.parse(params);

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
    executeTransactionObj.perform(slowProcessor).then(function (response) {
      if (!response.isSuccess()) {
        if(response.err.msg=='lifo fire'){
          publishToSlowQueue(parsedParams)
        }
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
};

const publishToSlowQueue = async function (parsedParams) {
  openSTNotification.publishEvent.perform(
    {
      topics: ['slow.transaction.execute'],
      publisher: parsedParams.publisher,
      message: parsedParams.message
    }
  ).then(console.log, console.log);
};

const PromiseQueueManager = new PromiseQueueManagerKlass(promiseExecutor, {
  name: "execute_tx_promise_queue_manager"
  , timeoutInMilliSecs: 3 * 60 * 1000
});

var topicPrefix = slowProcessor ? 'slow.' : '';

openSTNotification.subscribeEvent.rabbit([topicPrefix+"transaction.execute"],
  {
    queue: topicPrefix+'transaction_execute_from_restful_apis',
    ackRequired: 1,
    prefetch: ((slowProcessor || '') == 'slow') ? 25 : 100
  },
  function (params) {

    // Promise is required to be returned to manually ack messages in RMQ
    return PromiseQueueManager.createPromise( params );

  }
);

// Using a single function to handle multiple signals
function handle() {
  logger.info('Received Signal');

  if ( !PromiseQueueManager.getPendingCount() && !unAckCount ) {
    console.log("SIGINT/SIGTERM handle :: No pending Promises.");
    process.exit( 0 );
  }


  // The OLD Way - Begin
  var f = function(){
    if ( unAckCount != PromiseQueueManager.getPendingCount() ) {
      console.log("ERROR :: unAckCount and pending counts are not in sync.");
    }
    if ( PromiseQueueManager.getPendingCount() <= 0 || unAckCount <= 0 ) {
      console.log("SIGINT/SIGTERM handle :: No pending Promises.");
      process.exit( 0 );
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



