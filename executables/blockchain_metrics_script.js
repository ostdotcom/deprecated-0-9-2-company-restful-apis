'use strict';

/**
 *
 * This script is used to get the tx related metrics for blockNumbers specified in arguments.
 *
 * Usage: node executables/one_timers/blockchain_metrics_script.js 'providerEndpoint' startBlockNumber endBlockNumber
 * Example: node executables/one_timers/blockchain_metrics_script.js 'ws://127.0.0.1:19547' 1000 1500
 *
 */

const args = process.argv,
  provider = args[2],
  startBlock = args[3],
  endBlock = args[4];

const Web3 = require('web3'),
  web3 = new Web3(provider);

let totalTxCount = 0,
  totalSuccessCount = 0,
  totalFailureCount = 0;

const GetCount = function() {};

GetCount.prototype = {
  perform: async function() {
    let st = parseInt(startBlock),
      end = parseInt(endBlock);

    for (let i = st; i <= end; i++) {
      let successCount = 0,
        failureCount = 0;

      let totalBlockTxCount = await web3.eth.getBlockTransactionCount(i),
        blockData = await web3.eth.getBlock(i, true);

      if (blockData.transactions.length !== 0) {
        let transactionsArray = blockData.transactions;
        for (let index in transactionsArray) {
          let transactionData = transactionsArray[index],
            transactionReceipt = await web3.eth.getTransactionReceipt(transactionData.hash);

          if (transactionReceipt.status) {
            successCount++;
          } else {
            failureCount++;
          }
        }
      }

      totalTxCount = totalTxCount + totalBlockTxCount;
      totalSuccessCount = totalSuccessCount + successCount;
      totalFailureCount = totalFailureCount + failureCount;
    }
  }
};

let obj = new GetCount();

obj.perform().then(function(r) {
  console.log('Total number of Blocks: ', endBlock - startBlock);
  console.log('Total transaction count (Cumulative txCount): ', totalTxCount);
  console.log('Total success count: ', totalSuccessCount);
  console.log('Total failure count: ', totalFailureCount);

  if (endBlock === startBlock) {
    //To handle case when only 1 block is needed.
    console.log('Average transaction count for given range', totalTxCount);
  } else {
    let averageTxCount = totalTxCount / (endBlock - startBlock);
    console.log('Average transaction count for given range', averageTxCount);
  }

  console.log('====Script Finished====');

  process.exit(0);
});
