'use strict';

/**
 * This code acts as a worker process for block scanner, which takes the transactions from delegator
 * and processes it using block scanner class. [ lib/block_scanner/for_tx_status_and_balance_sync.js ]
 *
 * Usage: node executables/rmq_subscribers/block_scanner.js processlockId group_id prefetchCountStr [benchmarkFilePath]
 *
 * Command Line Parameters Description:
 * processlockId: used for ensuring that no other process with the same processlockId can run on a given machine.
 * group_id: group_id to fetch config strategy
 * prefetchCountStr: prefetch count for RMQ subscribers.
 * [benchmarkFilePath]: path to the file which is storing the benchmarking info.
 *
 * @module executables/rmq_subscribers/block_scanner
 */

const rootPrefix = '../..';

const program = require('commander');

program
  .option('--processlock-id <processlockId>', 'Process Lock id')
  .option('--group-id <groupId>', 'Group id')
  .option('--prefetch-count <prefetchCount>', 'Prefetch Count')
  .option('--benchmark-file-path [benchmarkFilePath]', 'Path to benchmark file path');

program.on('--help', () => {
  console.log('');
  console.log('  Example:');
  console.log('');
  console.log(
    '    node ./executables/rmq_subscribers/block_scanner.js --processlock-id 1 --group-id 197 --prefetch-count 2 --benchmark-file-path [benchmarkFilePath]'
  );
  console.log('');
  console.log('');
});

program.parse(process.argv);

// Validate and sanitize the commander parameters.
const validateAndSanitize = function() {
  if (!program.processlockId || !program.groupId || !program.prefetchCount) {
    program.help();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  ProcessLocker = new ProcessLockerKlass(program);

let ic = null,
  openStNotification = null,
  web3InteractFactory = null;

require(rootPrefix + '/lib/block_scanner/for_tx_status_and_balance_sync');
require(rootPrefix + '/lib/web3/interact/ws_interact');
require(rootPrefix + '/lib/providers/notification');

// Load external packages
const OSTBase = require('@openstfoundation/openst-base');

const warmUpGethPool = function() {
  return new Promise(async function(onResolve, onReject) {
    let utilityGethType = 'read_only',
      strategyByGroupHelperObj = new StrategyByGroupHelper(program.groupId),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(utilityGethType),
      configStrategy = configStrategyResp.data;

    ic = new InstanceComposer(configStrategy);
    web3InteractFactory = ic.getWeb3InteractHelper();

    let web3PoolSize = coreConstants.OST_WEB3_POOL_SIZE;

    for (let ind = 0; ind < configStrategy.OST_UTILITY_GETH_WS_PROVIDERS.length; ind++) {
      let provider = configStrategy.OST_UTILITY_GETH_WS_PROVIDERS[ind];
      for (let i = 0; i < web3PoolSize; i++) {
        web3InteractFactory.getInstance('utility', provider);
      }
    }

    return onResolve();
  });
};

// Check if another process with the same title is running.
ProcessLocker.canStartProcess({
  process_title: 'executables_rmq_subscribers_block_scanner_' + program.groupId + '_' + program.processlockId
});

let unAckCount = 0,
  prefetchCountInt = parseInt(program.prefetchCount);

const promiseExecutor = async function(onResolve, onReject, params) {
  const oThis = this;

  unAckCount++;

  // Process request
  // TODO: put try catch around JSON parse
  const parsedParams = JSON.parse(params);

  const payload = parsedParams.message.payload;

  let BlockScannerKlass = ic.getBlockScannerKlass(),
    blockScannerObj = new BlockScannerKlass({
      block_number: payload.blockNumber,
      geth_array: payload.gethArray,
      transaction_hashes: payload.transactionHashes,
      time_stamp: payload.timestamp,
      benchmark_file_path: program.benchmarkFilePath,
      web3_factory_obj: web3InteractFactory,
      delegator_timestamp: payload.delegatorTimestamp
    });

  try {
    blockScannerObj
      .perform()
      .then(function() {
        unAckCount--;
        logger.debug('------ unAckCount -> ', unAckCount);
        // ack RMQ
        return onResolve();
      })
      .catch(function(err) {
        logger.error(
          'e_rmqs_bs_1',
          'Something went wrong in blockscanner execution. unAckCount ->',
          unAckCount,
          err,
          params
        );
        unAckCount--;
        // ack RMQ
        return onResolve();
      });
  } catch (err) {
    unAckCount--;
    logger.error('Listener could not process blockscanner.. Catch. unAckCount -> ', unAckCount);
  }
};

let PromiseQueueManager = null;

warmUpGethPool()
  .then(function() {
    PromiseQueueManager = new OSTBase.OSTPromise.QueueManager(promiseExecutor, {
      name: 'blockscanner_promise_queue_manager',
      timeoutInMilliSecs: 3 * 60 * 1000, //3 minutes
      maxZombieCount: Math.round(prefetchCountInt * 0.25),
      onMaxZombieCountReached: function() {
        logger.warn('e_rmqs_bs_2', 'maxZombieCount reached. Triggering SIGTERM.');
        // Trigger gracefully shutdown of process.
        process.kill(process.pid, 'SIGTERM');
      }
    });

    let chain_id = ic.configStrategy.OST_UTILITY_CHAIN_ID,
      notificationProvider = ic.getNotificationProvider();

    openStNotification = notificationProvider.getInstance();

    openStNotification.subscribeEvent.rabbit(
      ['block_scanner_execute_' + chain_id],
      {
        queue: 'block_scanner_execute_' + chain_id,
        ackRequired: 1,
        prefetch: prefetchCountInt
      },
      function(params) {
        // Promise is required to be returned to manually ack messages in RMQ
        return PromiseQueueManager.createPromise(params);
      }
    );
  })
  .catch(function(error) {
    logger.error(error);
  });

// Using a single function to handle multiple signals
function handle() {
  logger.info('Received Signal');

  if (!PromiseQueueManager.getPendingCount() && !unAckCount) {
    console.log('SIGINT/SIGTERM handle :: No pending Promises.');
    process.exit(1);
  }

  let f = function() {
    if (unAckCount != PromiseQueueManager.getPendingCount()) {
      logger.error('ERROR :: unAckCount and pending counts are not in sync.');
    }
    if (PromiseQueueManager.getPendingCount() <= 0 || unAckCount <= 0) {
      console.log('SIGINT/SIGTERM handle :: No pending Promises.');
      process.exit(1);
    } else {
      logger.info('waiting for open tasks to be done.');
      setTimeout(f, 1000);
    }
  };

  setTimeout(f, 1000);
}

// handling gracefully process exit on getting SIGINT, SIGTERM.
// Once signal found programme will stop consuming new messages. But need to clear running messages.
process.on('SIGINT', handle);
process.on('SIGTERM', handle);
