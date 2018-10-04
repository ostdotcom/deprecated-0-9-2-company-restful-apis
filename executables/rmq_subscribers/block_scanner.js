'use strict';

const rootPrefix = '../..';

const args = process.argv,
  processLockId = args[2],
  group_id = args[3],
  prefetchCountStr = args[4],
  benchmarkFilePath = args[5];

const logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  coreConstants = require(rootPrefix + '/config/core_constants'),
  StrategyByGroupHelper = require(rootPrefix + '/helpers/config_strategy/by_group_id'),
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  ProcessLockerKlass = require(rootPrefix + '/lib/process_locker'),
  ProcessLocker = new ProcessLockerKlass();

let ic = null,
  web3InteractFactory = null;

require(rootPrefix + '/lib/block_scanner/for_tx_status_and_balance_sync');
require(rootPrefix + '/lib/web3/interact/ws_interact');

// Load external packages
const openSTNotification = require('@openstfoundation/openst-notification'),
  OSTBase = require('@openstfoundation/openst-base');

// Usage demo.
const usageDemo = function() {
  logger.log(
    'usage:',
    'node ./executables/rmq_subscribers/block_scanner.js processLockId group_id prefetchCountStr [benchmarkFilePath]'
  );
  logger.log(
    '* processLockId is used for ensuring that no other process with the same processLockId can run on a given machine.'
  );
  logger.log('* group_id is needed to fetch config strategy.');
  logger.log('* benchmarkFilePath is the path to the file which is storing the benchmarking info.');
};

const warmUpGethPool = function() {
  return new Promise(async function(onResolve, onReject) {
    let strategyByGroupHelperObj = new StrategyByGroupHelper(group_id),
      configStrategyResp = await strategyByGroupHelperObj.getCompleteHash(),
      configStrategy = configStrategyResp.data;

    ic = new InstanceComposer(configStrategy);
    web3InteractFactory = ic.getWeb3InteractHelper();

    let web3PoolSize = coreConstants.OST_WEB3_POOL_SIZE;

    for (let ind = 0; ind < configStrategy.OST_UTILITY_GETH_WS_PROVIDERS.length; ind++) {
      let provider = configStrategy.OST_UTILITY_GETH_WS_PROVIDERS[ind];
      for (let i = 0; i < web3PoolSize; i++) {
        web3InteractFactory.getInstance('utility', provider); //TODO: Align it with read/write and master process
      }
    }

    return onResolve();
  });
};

// Validate and sanitize the command line arguments.
const validateAndSanitize = function() {
  if (!processLockId) {
    logger.error('Process Lock id NOT passed in the arguments.');
    usageDemo();
    process.exit(1);
  }

  if (!group_id) {
    logger.error('group_id is not passed');
    usageDemo();
    process.exit(1);
  }

  if (!prefetchCountStr) {
    logger.error('prefetchCountStr is not passed');
    usageDemo();
    process.exit(1);
  }
};

// Validate and sanitize the input params.
validateAndSanitize();

// Check if another process with the same title is running.
ProcessLocker.canStartProcess({ process_title: 'executables_rmq_subscribers_block_scanner_' + processLockId });

let unAckCount = 0,
  prefetchCount = parseInt(prefetchCountStr);

const promiseExecutor = async function(onResolve, onReject, params) {
  const oThis = this;

  unAckCount++;

  // Process request
  const parsedParams = JSON.parse(params);

  const payload = parsedParams.message.payload;

  let BlockScannerKlass = ic.getBlockScannerKlass(),
    blockScannerObj = new BlockScannerKlass({
      blockNumber: payload.blockNumber,
      geth_array: payload.geth_array,
      transactionHashes: payload.transactionHashes,
      timeStamp: payload.timestamp,
      benchmarkFilePath: benchmarkFilePath,
      web3InteractFactory: web3InteractFactory
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

warmUpGethPool().then(function() {
  PromiseQueueManager = new OSTBase.OSTPromise.QueueManager(promiseExecutor, {
    name: 'blockscanner_promise_queue_manager',
    timeoutInMilliSecs: 3 * 60 * 1000, //3 minutes
    maxZombieCount: Math.round(prefetchCount * 0.25),
    onMaxZombieCountReached: function() {
      logger.warn('e_rmqs_bs_2', 'maxZombieCount reached. Triggering SIGTERM.');
      // Trigger gracefully shutdown of process.
      process.kill(process.pid, 'SIGTERM');
    }
  });

  openSTNotification.subscribeEvent.rabbit(
    ['block_scanner_execute_' + group_id],
    {
      queue: 'block_scanner_execute_' + group_id,
      ackRequired: 1,
      prefetch: prefetchCount
    },
    function(params) {
      // Promise is required to be returned to manually ack messages in RMQ
      return PromiseQueueManager.createPromise(params);
    }
  );
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
